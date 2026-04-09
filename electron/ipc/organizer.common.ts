import path from 'node:path';
import fs from 'node:fs/promises';
import { listDirectories } from '@main/utils/fsUtils';
import { normalizeAbsolutePath } from '@main/utils/pathUtils';

interface OrganizerLibrarySource {
  path: string;
  isTarget: boolean;
}

interface OrganizerLibraryRepositoryLike {
  list: () => OrganizerLibrarySource[];
}

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MIN_MANGA_IMAGE_COUNT = 4;

export function resolveSourceFolderPath(nextFolderPath: string, availableSourcePaths: string[], fallback: string): string {
  const normalizedNextPath = normalizeAbsolutePath(nextFolderPath);
  const candidates = availableSourcePaths
    .map((value) => normalizeAbsolutePath(value))
    .sort((a, b) => b.length - a.length);

  for (const sourcePath of candidates) {
    if (normalizedNextPath === sourcePath || normalizedNextPath.startsWith(`${sourcePath}${path.sep}`)) {
      return sourcePath;
    }
  }

  return normalizeAbsolutePath(fallback);
}

async function countDirectImageFiles(directoryPath: string): Promise<number> {
  try {
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())).length;
  } catch {
    return 0;
  }
}

async function findMangaDepth(directoryPath: string, depth: number): Promise<number | null> {
  const directImageCount = await countDirectImageFiles(directoryPath);
  if (directImageCount >= MIN_MANGA_IMAGE_COUNT) {
    return 0;
  }

  if (depth <= 0) {
    return null;
  }

  try {
    const children = await listDirectories(directoryPath);
    for (const childPath of children) {
      const childDepth = await findMangaDepth(childPath, depth - 1);
      if (childDepth !== null) {
        return childDepth + 1;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export async function detectAuthorRootDirectory(candidatePath: string): Promise<boolean> {
  try {
    const children = await listDirectories(candidatePath);
    if (children.length === 0) {
      return false;
    }

    let directMangaChildren = 0;
    let authorLikeChildren = 0;

    for (const childPath of children) {
      const mangaDepth = await findMangaDepth(childPath, 2);
      if (mangaDepth === 0) {
        directMangaChildren += 1;
        continue;
      }

      if (mangaDepth !== null && mangaDepth >= 1) {
        authorLikeChildren += 1;
      }
    }

    return authorLikeChildren > 0 && directMangaChildren === 0;
  } catch {
    return false;
  }
}

export async function findAuthorRootSources(library: OrganizerLibraryRepositoryLike): Promise<string[]> {
  const sources = library.list();
  const matches = await Promise.all(
    sources.map(async (source) => ({
      path: normalizeAbsolutePath(source.path),
      isAuthorRoot: await detectAuthorRootDirectory(source.path)
    }))
  );

  return matches.filter((item) => item.isAuthorRoot).map((item) => item.path);
}

export async function listArtistsRoots(library: OrganizerLibraryRepositoryLike): Promise<string[]> {
  const roots = await findAuthorRootSources(library);
  return roots.length === 1 ? roots : [];
}
