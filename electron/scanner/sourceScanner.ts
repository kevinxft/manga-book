import fs from 'node:fs/promises';
import path from 'node:path';
import type { MangaStructure } from '@shared/types';
import type { Repositories } from '@main/db';
import { directoryExists, listDirectories } from '@main/utils/fsUtils';
import { normalizeAbsolutePath } from '@main/utils/pathUtils';
import { invalidateCoverPath } from './coverFinder';
import { findArtistsDirectoryPath } from '@main/ipc/organizer.common';
import { isMetadataDirectoryPath } from '@main/db/sourceMetadata';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MIN_MANGA_IMAGE_COUNT = 4;

export interface ScanProgressPayload {
  current: number;
  total: number;
  message: string;
  sourceCurrent: number;
  sourceTotal: number;
  sourceName: string;
  itemCurrent: number;
  itemTotal: number;
  currentItemName: string;
}

export interface SourceScanner {
  syncSources: (
    sourcePaths: string[],
    onProgress?: (payload: ScanProgressPayload) => void,
    signal?: AbortSignal
  ) => Promise<void>;
}

interface FolderInspection {
  structure: MangaStructure;
  totalPages: number;
}

interface MangaEntry {
  folderPath: string;
  inspection: FolderInspection;
}

function isIgnorableDirectoryReadError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error.code === 'ENOENT' || error.code === 'ENOTDIR')
  );
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error('SCAN_ABORTED');
  }
}

async function listImageFiles(directoryPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
      .map((entry) => path.join(directoryPath, entry.name));
  } catch (error) {
    if (isIgnorableDirectoryReadError(error)) {
      return [];
    }
    throw error;
  }
}

function buildScanProgressPayload(input: ScanProgressPayload): ScanProgressPayload {
  return input;
}

async function inspectFolderAsManga(folderPath: string, allowChildDirectories = true): Promise<FolderInspection | null> {
  const directImages = await listImageFiles(folderPath);
  if (directImages.length >= MIN_MANGA_IMAGE_COUNT) {
    return {
      structure: 'singleVolume',
      totalPages: directImages.length
    };
  }

  if (!allowChildDirectories) {
    return null;
  }

  let childDirectories: string[];
  try {
    childDirectories = await listDirectories(folderPath);
  } catch (error) {
    if (isIgnorableDirectoryReadError(error)) {
      return null;
    }
    throw error;
  }
  let totalChildPages = 0;
  let hasChildVolume = false;
  let childVolumeCount = 0;

  for (const childDirectory of childDirectories) {
    const childImages = await listImageFiles(childDirectory);
    if (childImages.length === 0) {
      continue;
    }
    hasChildVolume = true;
    childVolumeCount += 1;
    totalChildPages += childImages.length;
  }

  // If only one child directory actually contains pages, that child is usually the real manga folder.
  // Let recursion continue so we use the child directory name instead of its parent container.
  if (childVolumeCount === 1) {
    return null;
  }

  if (hasChildVolume) {
    return {
      structure: 'multiVolume',
      totalPages: totalChildPages
    };
  }

  return null;
}

function isInsidePath(targetPath: string, parentPath: string): boolean {
  return targetPath === parentPath || targetPath.startsWith(`${parentPath}${path.sep}`);
}

async function discoverMangaEntries(
  rootPath: string,
  artistsRootPath: string | null,
  signal?: AbortSignal
): Promise<MangaEntry[]> {
  const discovered: MangaEntry[] = [];
  const stack: string[] = [rootPath];

  while (stack.length > 0) {
    assertNotAborted(signal);
    const currentPath = stack.pop();
    if (!currentPath) {
      continue;
    }

    if (!(await directoryExists(currentPath))) {
      continue;
    }

    const relativePath = path.relative(rootPath, currentPath);
    const relativeSegments = relativePath === '' ? [] : relativePath.split(path.sep).filter(Boolean);

    const withinArtistsRoot = artistsRootPath ? isInsidePath(currentPath, artistsRootPath) : false;
    const artistsRelativeSegments =
      withinArtistsRoot && artistsRootPath
        ? path.relative(artistsRootPath, currentPath).split(path.sep).filter(Boolean)
        : [];

    // The source root is always a container. When an `Artists` directory exists, we only treat
    // `Artists` itself and its direct child author directories as containers; manga detection starts
    // below `Artists/<author>/...`.
    const shouldSkipAsContainer =
      relativeSegments.length === 0 ||
      (withinArtistsRoot && artistsRelativeSegments.length <= 1);

    const allowChildDirectoriesAsMultiVolume = withinArtistsRoot && artistsRelativeSegments.length >= 2;

    if (!shouldSkipAsContainer) {
      const inspection = await inspectFolderAsManga(currentPath, allowChildDirectoriesAsMultiVolume);
      if (inspection) {
        discovered.push({
          folderPath: currentPath,
          inspection
        });
        continue;
      }
    }

    let childDirectories: string[];
    try {
      childDirectories = await listDirectories(currentPath);
    } catch (error) {
      if (isIgnorableDirectoryReadError(error)) {
        continue;
      }
      throw error;
    }
    for (let index = childDirectories.length - 1; index >= 0; index -= 1) {
      const childDirectory = childDirectories[index];
      if (!childDirectory) {
        continue;
      }
      if (isMetadataDirectoryPath(childDirectory)) {
        continue;
      }
      stack.push(normalizeAbsolutePath(childDirectory));
    }
  }

  const dedupMap = new Map<string, MangaEntry>();
  for (const entry of discovered) {
    dedupMap.set(entry.folderPath, entry);
  }

  return Array.from(dedupMap.values()).sort((a, b) => a.folderPath.localeCompare(b.folderPath));
}

export function createSourceScanner(repositories: Repositories): SourceScanner {
  const { manga } = repositories;

  async function syncSingleSource(
    sourcePath: string,
    sourceCurrent: number,
    sourceTotal: number,
    onProgress?: (payload: ScanProgressPayload) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const normalizedSourcePath = normalizeAbsolutePath(sourcePath);
    const sourceName = path.basename(normalizedSourcePath);
    const exists = await directoryExists(normalizedSourcePath);

    if (!exists) {
      manga.deleteBySource(normalizedSourcePath);
      return;
    }

    const dbMangas = manga.listBySource(normalizedSourcePath);
    const dbPathSet = new Set(dbMangas.map((book) => book.folderPath));

    const artistsRootPath = await findArtistsDirectoryPath(normalizedSourcePath);
    const discoveredEntries = await discoverMangaEntries(normalizedSourcePath, artistsRootPath, signal);
    const fsPathSet = new Set(discoveredEntries.map((entry) => entry.folderPath));

    for (let index = 0; index < discoveredEntries.length; index += 1) {
      assertNotAborted(signal);
      const entry = discoveredEntries[index];
      if (!entry) {
        continue;
      }

      manga.upsert({
        title: path.basename(entry.folderPath),
        folderPath: entry.folderPath,
        sourceFolderPath: normalizedSourcePath,
        structure: entry.inspection.structure,
        totalPages: entry.inspection.totalPages
      });

      onProgress?.(
        buildScanProgressPayload({
          current: sourceCurrent,
          total: sourceTotal,
          message: `Scanning ${sourceName}`,
          sourceCurrent,
          sourceTotal,
          sourceName,
          itemCurrent: index + 1,
          itemTotal: discoveredEntries.length,
          currentItemName: path.basename(entry.folderPath)
        })
      );
    }

    if (discoveredEntries.length === 0) {
      onProgress?.(
        buildScanProgressPayload({
          current: sourceCurrent,
          total: sourceTotal,
          message: `No manga found in ${sourceName}`,
          sourceCurrent,
          sourceTotal,
          sourceName,
          itemCurrent: 0,
          itemTotal: 0,
          currentItemName: ''
        })
      );
    }

    for (const stalePath of dbPathSet) {
      assertNotAborted(signal);
      if (!fsPathSet.has(stalePath)) {
        manga.deleteByFolderPath(stalePath);
        invalidateCoverPath(stalePath);
      }
    }
  }

  async function syncSources(
    sourcePaths: string[],
    onProgress?: (payload: ScanProgressPayload) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const total = sourcePaths.length;
    let current = 0;

    for (const sourcePath of sourcePaths) {
      assertNotAborted(signal);
      current += 1;
      const sourceName = path.basename(normalizeAbsolutePath(sourcePath));
      onProgress?.(
        buildScanProgressPayload({
          current,
          total,
          message: `Scanning ${sourceName}`,
          sourceCurrent: current,
          sourceTotal: total,
          sourceName,
          itemCurrent: 0,
          itemTotal: 0,
          currentItemName: ''
        })
      );
      await syncSingleSource(sourcePath, current, total, onProgress, signal);
    }

    onProgress?.(
      buildScanProgressPayload({
        current: total,
        total,
        message: total > 0 ? 'Scan finished' : 'No source configured',
        sourceCurrent: total,
        sourceTotal: total,
        sourceName: '',
        itemCurrent: 0,
        itemTotal: 0,
        currentItemName: ''
      })
    );
  }

  return {
    syncSources
  };
}
