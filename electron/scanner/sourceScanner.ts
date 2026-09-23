import fs from 'node:fs/promises';
import path from 'node:path';
import { setImmediate as waitForImmediate } from 'node:timers/promises';
import type { MangaStructure } from '@shared/types';
import type { Repositories } from '@main/db';
import { directoryExists, listDirectories } from '@main/utils/fsUtils';
import { normalizeAbsolutePath } from '@main/utils/pathUtils';
import { invalidateCoverPath } from './coverFinder';
import {
  findAuthorsDirectoryPath,
  findUnsortedDirectoryPath,
  getAuthorsDirectoryPath,
  getUnsortedDirectoryPath
} from '@main/ipc/organizer.common';
import { isMetadataDirectoryPath } from '@main/db/sourceMetadata';
import { isSupportedImageFile } from '@main/utils/imageFiles';


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
  syncImportedDirectories: (
    sourcePath: string,
    directoryPaths: string[],
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

async function yieldToEventLoop(signal?: AbortSignal): Promise<void> {
  assertNotAborted(signal);
  await waitForImmediate();
  assertNotAborted(signal);
}

async function listImageFiles(directoryPath: string, signal?: AbortSignal): Promise<string[]> {
  assertNotAborted(signal);
  try {
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    assertNotAborted(signal);
    return entries
      .filter((entry) => entry.isFile() && isSupportedImageFile(entry.name))
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

async function inspectFolderAsManga(folderPath: string, allowChildDirectories = true, signal?: AbortSignal): Promise<FolderInspection | null> {
  assertNotAborted(signal);
  const directImages = await listImageFiles(folderPath, signal);
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
    assertNotAborted(signal);
    childDirectories = await listDirectories(folderPath);
    assertNotAborted(signal);
  } catch (error) {
    if (isIgnorableDirectoryReadError(error)) {
      return null;
    }
    throw error;
  }
  let totalChildPages = 0;
  let hasChildVolume = false;
  let childVolumeCount = 0;

  for (let index = 0; index < childDirectories.length; index += 1) {
    assertNotAborted(signal);
    if (index > 0 && index % 25 === 0) {
      await yieldToEventLoop(signal);
    }
    const childDirectory = childDirectories[index];
    if (!childDirectory) {
      continue;
    }
    const childImages = await listImageFiles(childDirectory, signal);
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
  authorsRootPath: string | null,
  signal?: AbortSignal,
  options?: {
    treatRootAsContainer?: boolean;
  }
): Promise<MangaEntry[]> {
  const discovered: MangaEntry[] = [];
  const stack: string[] = [rootPath];
  let inspectedDirectoryCount = 0;
  const treatRootAsContainer = options?.treatRootAsContainer ?? true;

  while (stack.length > 0) {
    assertNotAborted(signal);
    inspectedDirectoryCount += 1;
    if (inspectedDirectoryCount % 25 === 0) {
      await yieldToEventLoop(signal);
    }
    const currentPath = stack.pop();
    if (!currentPath) {
      continue;
    }
    let currentStat: Awaited<ReturnType<typeof fs.stat>>;
    try {
      currentStat = await fs.stat(currentPath);
    } catch (error) {
      if (isIgnorableDirectoryReadError(error)) {
        continue;
      }
      throw error;
    }
    if (!currentStat.isDirectory()) {
      continue;
    }
    assertNotAborted(signal);

    const relativePath = path.relative(rootPath, currentPath);
    const relativeSegments = relativePath === '' ? [] : relativePath.split(path.sep).filter(Boolean);

    const withinAuthorsRoot = authorsRootPath ? isInsidePath(currentPath, authorsRootPath) : false;
    const authorsRelativeSegments =
      withinAuthorsRoot && authorsRootPath
        ? path.relative(authorsRootPath, currentPath).split(path.sep).filter(Boolean)
        : [];

    // The library root is always a container. When an `Authors` directory exists, we only treat
    // `Authors` itself and its direct child author directories as containers; manga detection starts
    // below `Authors/<author>/...`.
    const shouldSkipAsContainer =
      (relativeSegments.length === 0 && treatRootAsContainer) ||
      (withinAuthorsRoot && authorsRelativeSegments.length <= 1);

    const allowChildDirectoriesAsMultiVolume = withinAuthorsRoot && authorsRelativeSegments.length >= 2;

    if (!shouldSkipAsContainer) {
      const inspection = await inspectFolderAsManga(currentPath, allowChildDirectoriesAsMultiVolume, signal);
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
      assertNotAborted(signal);
    } catch (error) {
      if (isIgnorableDirectoryReadError(error)) {
        continue;
      }
      throw error;
    }
    for (let index = childDirectories.length - 1; index >= 0; index -= 1) {
      assertNotAborted(signal);
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
    let sourceStat: Awaited<ReturnType<typeof fs.stat>>;
    try {
      sourceStat = await fs.stat(normalizedSourcePath);
    } catch (error) {
      if (isIgnorableDirectoryReadError(error)) {
        manga.deleteBySource(normalizedSourcePath);
        return;
      }
      throw error;
    }
    assertNotAborted(signal);

    if (!sourceStat.isDirectory()) {
      manga.deleteBySource(normalizedSourcePath);
      return;
    }

    const sourceName = path.basename(normalizedSourcePath);
    const dbMangas = manga.listBySource(normalizedSourcePath);
    const dbPathSet = new Set(dbMangas.map((book) => book.folderPath));
    const authorsRootPath = (await findAuthorsDirectoryPath(normalizedSourcePath)) ?? getAuthorsDirectoryPath(normalizedSourcePath);
    const unsortedRootPath =
      (await findUnsortedDirectoryPath(normalizedSourcePath)) ?? getUnsortedDirectoryPath(normalizedSourcePath);

    async function discoverRoot(rootPath: string, authorsPath: string | null): Promise<MangaEntry[] | null> {
      try {
        const rootStat = await fs.stat(rootPath);
        if (!rootStat.isDirectory()) {
          return [];
        }
      } catch (error) {
        if (isIgnorableDirectoryReadError(error)) {
          return [];
        }
        throw error;
      }

      try {
        return await discoverMangaEntries(rootPath, authorsPath, signal);
      } catch (error) {
        if (isIgnorableDirectoryReadError(error)) {
          return null;
        }
        throw error;
      }
    }

    assertNotAborted(signal);
    const [authorsEntries, unsortedEntries] = await Promise.all([
      discoverRoot(authorsRootPath, authorsRootPath),
      discoverRoot(unsortedRootPath, null)
    ]);
    if (!authorsEntries || !unsortedEntries) {
      return;
    }

    try {
      if (!(await fs.stat(normalizedSourcePath)).isDirectory()) {
        return;
      }
    } catch (error) {
      if (isIgnorableDirectoryReadError(error)) {
        return;
      }
      throw error;
    }

    const discoveredEntries = [...authorsEntries, ...unsortedEntries].sort((a, b) => a.folderPath.localeCompare(b.folderPath));
    const fsPathSet = new Set(discoveredEntries.map((entry) => entry.folderPath));

    for (let index = 0; index < discoveredEntries.length; index += 1) {
      assertNotAborted(signal);
      if (index > 0 && index % 20 === 0) {
        await yieldToEventLoop(signal);
      }
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

    let sourceRemainsDirectory: boolean;
    try {
      sourceRemainsDirectory = (await fs.stat(normalizedSourcePath)).isDirectory();
    } catch (error) {
      if (isIgnorableDirectoryReadError(error)) {
        return;
      }
      throw error;
    }
    if (!sourceRemainsDirectory) {
      return;
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

  async function syncImportedDirectories(
    sourcePath: string,
    directoryPaths: string[],
    onProgress?: (payload: ScanProgressPayload) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const normalizedSourcePath = normalizeAbsolutePath(sourcePath);
    const targetDirectories = Array.from(
      new Set(
        directoryPaths
          .map((directoryPath) => normalizeAbsolutePath(directoryPath))
          .filter(Boolean)
      )
    );

    if (targetDirectories.length === 0) {
      onProgress?.(
        buildScanProgressPayload({
          current: 0,
          total: 0,
          message: 'No imported directories to scan',
          sourceCurrent: 0,
          sourceTotal: 0,
          sourceName: '',
          itemCurrent: 0,
          itemTotal: 0,
          currentItemName: ''
        })
      );
      return;
    }

    const dbMangas = manga.listBySource(normalizedSourcePath);
    const existingTargetMangas = dbMangas.filter((book) =>
      targetDirectories.some((directoryPath) => isInsidePath(book.folderPath, directoryPath))
    );
    const existingTargetPathSet = new Set(existingTargetMangas.map((book) => book.folderPath));
    const discoveredEntries: MangaEntry[] = [];

    for (let index = 0; index < targetDirectories.length; index += 1) {
      assertNotAborted(signal);
      const directoryPath = targetDirectories[index];
      if (!directoryPath) {
        continue;
      }

      onProgress?.(
        buildScanProgressPayload({
          current: index + 1,
          total: targetDirectories.length,
          message: `Scanning imported ${path.basename(directoryPath)}`,
          sourceCurrent: index + 1,
          sourceTotal: targetDirectories.length,
          sourceName: path.basename(directoryPath),
          itemCurrent: 0,
          itemTotal: 0,
          currentItemName: ''
        })
      );

      if (!(await directoryExists(directoryPath))) {
        continue;
      }

      const entries = await discoverMangaEntries(directoryPath, null, signal, {
        treatRootAsContainer: false
      });
      discoveredEntries.push(...entries);
    }

    const discoveredPathSet = new Set(discoveredEntries.map((entry) => entry.folderPath));

    for (let index = 0; index < discoveredEntries.length; index += 1) {
      assertNotAborted(signal);
      if (index > 0 && index % 20 === 0) {
        await yieldToEventLoop(signal);
      }

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
          current: targetDirectories.length,
          total: targetDirectories.length,
          message: 'Updating imported mangas',
          sourceCurrent: targetDirectories.length,
          sourceTotal: targetDirectories.length,
          sourceName: 'Imported',
          itemCurrent: index + 1,
          itemTotal: discoveredEntries.length,
          currentItemName: path.basename(entry.folderPath)
        })
      );
    }

    for (const stalePath of existingTargetPathSet) {
      assertNotAborted(signal);
      if (!discoveredPathSet.has(stalePath)) {
        manga.deleteByFolderPath(stalePath);
        invalidateCoverPath(stalePath);
      }
    }

    onProgress?.(
      buildScanProgressPayload({
        current: targetDirectories.length,
        total: targetDirectories.length,
        message: 'Imported scan finished',
        sourceCurrent: targetDirectories.length,
        sourceTotal: targetDirectories.length,
        sourceName: '',
        itemCurrent: 0,
        itemTotal: 0,
        currentItemName: ''
      })
    );
  }

  return {
    syncSources,
    syncImportedDirectories
  };
}
