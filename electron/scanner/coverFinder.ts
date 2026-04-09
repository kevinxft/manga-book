import path from 'node:path';
import { listDirectories, listFiles } from '@main/utils/fsUtils';

const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

interface CoverPathCacheEntry {
  folderPath: string;
  coverPath: string | null;
  updatedAt: number;
}

const coverPathCache = new Map<string, CoverPathCacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function isIgnorableDirectoryReadError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error.code === 'ENOENT' || error.code === 'ENOTDIR')
  );
}

function isImage(filePath: string): boolean {
  return SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

async function findCoverInDirectory(directoryPath: string): Promise<string | null> {
  let files: string[];
  try {
    files = await listFiles(directoryPath);
  } catch (error) {
    if (isIgnorableDirectoryReadError(error)) {
      return null;
    }
    throw error;
  }
  const sorted = files.sort((a, b) => a.localeCompare(b));
  const firstImage = sorted.find(isImage);
  return firstImage ?? null;
}

export async function resolveCoverPath(folderPath: string): Promise<string | null> {
  const cached = coverPathCache.get(folderPath);
  if (cached && Date.now() - cached.updatedAt < CACHE_TTL_MS) {
    return cached.coverPath;
  }

  let coverPath = await findCoverInDirectory(folderPath);

  if (!coverPath) {
    let subDirectories: string[];
    try {
      subDirectories = await listDirectories(folderPath);
    } catch (error) {
      if (isIgnorableDirectoryReadError(error)) {
        subDirectories = [];
      } else {
        throw error;
      }
    }
    subDirectories = subDirectories.sort((a, b) => a.localeCompare(b));
    for (const subDirectory of subDirectories) {
      coverPath = await findCoverInDirectory(subDirectory);
      if (coverPath) {
        break;
      }
    }
  }

  coverPathCache.set(folderPath, {
    folderPath,
    coverPath,
    updatedAt: Date.now()
  });

  return coverPath;
}

export function invalidateCoverPath(folderPath: string): void {
  coverPathCache.delete(folderPath);
}

export function clearCoverPathCache(): void {
  coverPathCache.clear();
}
