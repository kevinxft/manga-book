import path from 'node:path';
import { listDirectories } from '@main/utils/fsUtils';
import { normalizeAbsolutePath } from '@main/utils/pathUtils';
import { isMetadataDirectoryPath } from '@main/db/sourceMetadata';

interface OrganizerLibrarySource {
  path: string;
  isTarget: boolean;
}

interface OrganizerLibraryRepositoryLike {
  list: () => OrganizerLibrarySource[];
}

const ARTISTS_DIRECTORY_NAMES = new Set(['artists']);

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

export async function findArtistsDirectoryPath(candidatePath: string): Promise<string | null> {
  try {
    const children = (await listDirectories(candidatePath)).filter((childPath) => !isMetadataDirectoryPath(childPath));
    const match = children.find((childPath) => ARTISTS_DIRECTORY_NAMES.has(path.basename(childPath).toLocaleLowerCase()));
    return match ? normalizeAbsolutePath(match) : null;
  } catch {
    return null;
  }
}

export async function detectAuthorRootDirectory(candidatePath: string): Promise<boolean> {
  return (await findArtistsDirectoryPath(candidatePath)) !== null;
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
  const sourceRoots = await findAuthorRootSources(library);
  if (sourceRoots.length !== 1) {
    return [];
  }

  const artistsPath = await findArtistsDirectoryPath(sourceRoots[0] as string);
  return artistsPath ? [artistsPath] : [];
}
