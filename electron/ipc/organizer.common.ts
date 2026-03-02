import path from 'node:path';
import { listDirectories } from '@main/utils/fsUtils';
import { normalizeAbsolutePath } from '@main/utils/pathUtils';

interface OrganizerLibrarySource {
  path: string;
}

interface OrganizerLibraryRepositoryLike {
  list: () => OrganizerLibrarySource[];
}

export function normalizeDirectoryName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function isArtistsDirectoryName(name: string): boolean {
  const normalized = normalizeDirectoryName(name);
  return normalized === 'artists' || normalized === 'artist';
}

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

export async function listArtistsRoots(library: OrganizerLibraryRepositoryLike): Promise<string[]> {
  const roots: string[] = [];
  const sourceFolders = library.list();

  for (const source of sourceFolders) {
    const sourcePath = normalizeAbsolutePath(source.path);
    const sourceBaseName = path.basename(sourcePath);

    if (isArtistsDirectoryName(sourceBaseName)) {
      roots.push(sourcePath);
      continue;
    }

    try {
      const children = await listDirectories(sourcePath);
      const artistFolder = children.find((childPath) => isArtistsDirectoryName(path.basename(childPath)));
      if (artistFolder) {
        roots.push(normalizeAbsolutePath(artistFolder));
      }
    } catch {
      // ignore unreadable source path
    }
  }

  return Array.from(new Set(roots));
}
