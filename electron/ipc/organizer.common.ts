import path from 'node:path';
import { listDirectories } from '@main/utils/fsUtils';
import { normalizeAbsolutePath } from '@main/utils/pathUtils';
import { isMetadataDirectoryPath } from '@main/db/sourceMetadata';

interface OrganizerLibraryRootLike {
  path: string;
}

interface OrganizerLibraryRepositoryLike {
  getRoot?: () => OrganizerLibraryRootLike | null;
  list?: () => OrganizerLibraryRootLike[];
}

const AUTHORS_DIRECTORY_NAME = 'authors';
const UNSORTED_DIRECTORY_NAME = 'unsorted';

export function getLibraryRootPath(library: OrganizerLibraryRepositoryLike): string | null {
  const root = library.getRoot?.() ?? library.list?.()[0] ?? null;
  return root?.path ? normalizeAbsolutePath(root.path) : null;
}

export function getAuthorsDirectoryPath(libraryRootPath: string): string {
  return normalizeAbsolutePath(path.join(libraryRootPath, 'Authors'));
}

export function getUnsortedDirectoryPath(libraryRootPath: string): string {
  return normalizeAbsolutePath(path.join(libraryRootPath, 'Unsorted'));
}

export function isPathInsideDirectory(targetPath: string, directoryPath: string): boolean {
  const normalizedTargetPath = normalizeAbsolutePath(targetPath);
  const normalizedDirectoryPath = normalizeAbsolutePath(directoryPath);
  return (
    normalizedTargetPath === normalizedDirectoryPath ||
    normalizedTargetPath.startsWith(`${normalizedDirectoryPath}${path.sep}`)
  );
}

export function resolveSourceFolderPath(nextFolderPath: string, availableSourcePaths: string[], fallback: string): string {
  const normalizedNextPath = normalizeAbsolutePath(nextFolderPath);
  const candidates = availableSourcePaths
    .map((value) => normalizeAbsolutePath(value))
    .sort((a, b) => b.length - a.length);

  for (const sourcePath of candidates) {
    if (isPathInsideDirectory(normalizedNextPath, sourcePath)) {
      return sourcePath;
    }
  }

  return normalizeAbsolutePath(fallback);
}

export async function findAuthorsDirectoryPath(candidatePath: string): Promise<string | null> {
  try {
    const children = (await listDirectories(candidatePath)).filter((childPath) => !isMetadataDirectoryPath(childPath));
    const match = children.find(
      (childPath) => path.basename(childPath).toLocaleLowerCase() === AUTHORS_DIRECTORY_NAME
    );
    return match ? normalizeAbsolutePath(match) : null;
  } catch {
    return null;
  }
}

export async function findUnsortedDirectoryPath(candidatePath: string): Promise<string | null> {
  try {
    const children = (await listDirectories(candidatePath)).filter((childPath) => !isMetadataDirectoryPath(childPath));
    const match = children.find(
      (childPath) => path.basename(childPath).toLocaleLowerCase() === UNSORTED_DIRECTORY_NAME
    );
    return match ? normalizeAbsolutePath(match) : null;
  } catch {
    return null;
  }
}

export async function listAuthorDirectories(library: OrganizerLibraryRepositoryLike): Promise<string[]> {
  const rootPath = getLibraryRootPath(library);
  if (!rootPath) {
    return [];
  }

  const authorsPath = await findAuthorsDirectoryPath(rootPath);
  if (!authorsPath) {
    return [];
  }

  try {
    const directories = await listDirectories(authorsPath);
    return directories
      .filter((childPath) => !isMetadataDirectoryPath(childPath))
      .map((childPath) => normalizeAbsolutePath(childPath))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}
