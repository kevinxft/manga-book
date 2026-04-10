import fs from 'node:fs/promises';
import path from 'node:path';
import { shell } from 'electron';
import type { IpcContext } from './context';
import { fail, ok, registerHandler } from './helpers';
import { updateCachedCanonicalName } from './organizer.alias.ipc';
import { listArtistsRoots, resolveSourceFolderPath } from './organizer.common';
import { directoryExists, ensureDirectory, listDirectories, movePath, pathExists } from '@main/utils/fsUtils';
import { normalizeAbsolutePath, toKey } from '@main/utils/pathUtils';
import { clearCoverPathCache, invalidateCoverPath } from '@main/scanner/coverFinder';
import { isMetadataDirectoryPath } from '@main/db/sourceMetadata';

async function getAvailableDirectoryPath(
  destinationRoot: string,
  preferredName: string,
  currentPath?: string
): Promise<{ path: string; renamedDueToConflict: boolean }> {
  const normalizedCurrentPath = currentPath ? normalizeAbsolutePath(currentPath) : null;

  for (let index = 0; index < 10_000; index += 1) {
    const candidateName = index === 0 ? preferredName : `${preferredName}（${index}）`;
    const candidatePath = normalizeAbsolutePath(path.join(destinationRoot, candidateName));

    if (normalizedCurrentPath && candidatePath === normalizedCurrentPath) {
      return { path: candidatePath, renamedDueToConflict: false };
    }

    if (!(await pathExists(candidatePath))) {
      return { path: candidatePath, renamedDueToConflict: index > 0 };
    }
  }

  throw new Error(`Unable to find available directory name for ${preferredName}`);
}

export function registerOrganizerFileIpc(context: IpcContext): void {
  const { manga, library, directoryUsage, alias } = context.repositories;

  registerHandler('organizer.moveManga', async (request) => {
    const book = manga.getById(request.mangaId);
    if (!book) {
      return fail('NOT_FOUND', 'Manga not found');
    }

    const destinationRoot = normalizeAbsolutePath(request.destinationPath);
    await ensureDirectory(destinationRoot);

    const moveTarget = await getAvailableDirectoryPath(destinationRoot, path.basename(book.folderPath), book.folderPath);
    const nextFolderPath = moveTarget.path;
    await movePath(book.folderPath, nextFolderPath);

    const sourcePaths = library.list().map((source) => source.path);
    const nextSourceFolderPath = resolveSourceFolderPath(nextFolderPath, sourcePaths, book.sourceFolderPath);

    invalidateCoverPath(book.folderPath);
    const updated = manga.updatePath(book.id, path.basename(nextFolderPath), nextFolderPath, nextSourceFolderPath);
    directoryUsage.touch(destinationRoot);

    return ok({
      manga: updated,
      renamedDueToConflict: moveTarget.renamedDueToConflict
    });
  });

  registerHandler('organizer.renameManga', async (request) => {
    const book = manga.getById(request.mangaId);
    if (!book) {
      return fail('NOT_FOUND', 'Manga not found');
    }

    const parentDirectory = path.dirname(book.folderPath);
    const nextFolderPath = path.join(parentDirectory, request.newTitle);

    await movePath(book.folderPath, nextFolderPath);

    const sourcePaths = library.list().map((source) => source.path);
    const nextSourceFolderPath = resolveSourceFolderPath(nextFolderPath, sourcePaths, book.sourceFolderPath);

    invalidateCoverPath(book.folderPath);
    const updated = manga.updatePath(book.id, request.newTitle, nextFolderPath, nextSourceFolderPath);

    return ok(updated);
  });

  registerHandler('organizer.openMangaFolder', async (request) => {
    const book = manga.getById(request.mangaId);
    if (!book) {
      return fail('NOT_FOUND', 'Manga not found');
    }

    await shell.openPath(book.folderPath);
    return ok({ opened: true });
  });

  registerHandler('organizer.listAuthorDirectories', async () => {
    const artistsRoots = await listArtistsRoots(library);
    const directories: string[] = [];
    const normalizedRoots = artistsRoots.map((rootPath) => normalizeAbsolutePath(rootPath));

    for (const rootPath of normalizedRoots) {
      if (!(await directoryExists(rootPath))) {
        continue;
      }
      const children = (await listDirectories(rootPath)).filter((childPath) => !isMetadataDirectoryPath(childPath));
      for (const childPath of children) {
        directories.push(normalizeAbsolutePath(childPath));
      }
    }

    const mangaBooks = manga.list();
    const uniqueDirectories = Array.from(new Set(directories)).sort((a, b) => a.localeCompare(b));
    const countByDirectory = new Map(uniqueDirectories.map((directory) => [directory, 0]));

    for (const book of mangaBooks) {
      const bookFolderPath = normalizeAbsolutePath(book.folderPath);

      for (const rootPath of normalizedRoots) {
        const prefix = `${rootPath}${path.sep}`;
        if (!bookFolderPath.startsWith(prefix)) {
          continue;
        }

        const relativePath = path.relative(rootPath, bookFolderPath);
        const authorName = relativePath.split(path.sep).filter(Boolean)[0];
        if (!authorName) {
          break;
        }

        const authorDirectory = normalizeAbsolutePath(path.join(rootPath, authorName));
        countByDirectory.set(authorDirectory, (countByDirectory.get(authorDirectory) ?? 0) + 1);
        break;
      }
    }

    const usageByPath = new Map(
      directoryUsage.listByPaths(uniqueDirectories).map((item) => [normalizeAbsolutePath(item.directoryPath), item.lastMovedAt])
    );
    const summaries = uniqueDirectories.map((directory) => {
      const normalizedDirectory = normalizeAbsolutePath(directory);
      return {
        directory: normalizedDirectory,
        mangaCount: countByDirectory.get(normalizedDirectory) ?? 0,
        lastMovedAt: usageByPath.get(normalizedDirectory) ?? null
      };
    });

    return ok(summaries);
  });

  registerHandler('organizer.createAuthorDirectory', async (request) => {
    const name = request.name?.trim();
    if (!name) {
      return fail('VALIDATION', 'Author name is required');
    }
    if (name === '.' || name === '..' || /[\\/]/.test(name)) {
      return fail('VALIDATION', 'Invalid author directory name');
    }

    const artistsRoots = await listArtistsRoots(library);
    if (artistsRoots.length === 0) {
      return fail('NO_TARGET_ROOT', 'No author-root directory found. Please keep exactly one imported source that contains author folders.');
    }

    let targetRoot = artistsRoots[0] as string;
    const preferredBasePath = request.basePath?.trim();
    if (preferredBasePath) {
      const normalizedBasePath = normalizeAbsolutePath(preferredBasePath);
      const normalizedBaseParent = normalizeAbsolutePath(path.dirname(normalizedBasePath));
      const matchedRoot = artistsRoots.find(
        (rootPath) => rootPath === normalizedBasePath || rootPath === normalizedBaseParent
      );
      if (matchedRoot) {
        targetRoot = matchedRoot;
      }
    }

    const targetPath = normalizeAbsolutePath(path.join(targetRoot, name));
    const exists = await directoryExists(targetPath);
    if (!exists) {
      await ensureDirectory(targetPath);
      return ok({ path: targetPath, created: true });
    }

    return ok({ path: targetPath, created: false });
  });

  registerHandler('organizer.renameAuthorDirectory', async (request) => {
    const currentPath = normalizeAbsolutePath(request.directoryPath);
    const nextName = request.newName?.trim();

    if (!nextName) {
      return fail('VALIDATION', 'Author name is required');
    }
    if (nextName === '.' || nextName === '..' || /[\\/]/.test(nextName)) {
      return fail('VALIDATION', 'Invalid author directory name');
    }

    if (!(await directoryExists(currentPath))) {
      return fail('NOT_FOUND', 'Author directory not found');
    }

    const previousName = path.basename(currentPath);
    const nextPath = normalizeAbsolutePath(path.join(path.dirname(currentPath), nextName));

    if (nextPath === currentPath) {
      return ok({
        previousPath: currentPath,
        path: currentPath,
        previousName,
        name: nextName,
        updatedCount: 0
      });
    }

    if (await pathExists(nextPath)) {
      return fail('CONFLICT', 'Author directory already exists');
    }

    await movePath(currentPath, nextPath);

    const updatedCount = manga.renameDirectoryPrefix(currentPath, nextPath);
    clearCoverPathCache();

    alias.updateCanonicalName(previousName, nextName, nextPath);
    updateCachedCanonicalName(previousName, nextName);

    return ok({
      previousPath: currentPath,
      path: nextPath,
      previousName,
      name: nextName,
      updatedCount
    });
  });

  registerHandler('organizer.deleteAuthorDirectory', async (request) => {
    const currentPath = normalizeAbsolutePath(request.directoryPath);
    if (!(await directoryExists(currentPath))) {
      return fail('NOT_FOUND', 'Author directory not found');
    }

    const artistsRoots = (await listArtistsRoots(library)).map((rootPath) => normalizeAbsolutePath(rootPath));
    const parentPath = normalizeAbsolutePath(path.dirname(currentPath));
    if (!artistsRoots.includes(parentPath)) {
      return fail('VALIDATION', 'Only direct author directories can be deleted');
    }

    const prefix = `${currentPath}${path.sep}`;
    const mangaCount = manga.list().filter((book) => {
      const normalizedFolderPath = normalizeAbsolutePath(book.folderPath);
      return normalizedFolderPath === currentPath || normalizedFolderPath.startsWith(prefix);
    }).length;

    if (mangaCount > 0) {
      return fail('DIRECTORY_NOT_EMPTY', '该作者目录下还有漫画，不能删除。');
    }

    const previousName = path.basename(currentPath);
    const previousKey = toKey(previousName);
    for (const aliasItem of alias.list()) {
      if (toKey(aliasItem.canonicalName) !== previousKey) {
        continue;
      }
      alias.remove(aliasItem.alias, currentPath);
    }

    await fs.rm(currentPath, { recursive: true, force: false });
    return ok({ deleted: true, path: currentPath });
  });

  registerHandler('organizer.deleteManga', async (request) => {
    const book = manga.getById(request.mangaId);
    if (!book) {
      return fail('NOT_FOUND', 'Manga not found');
    }

    if (request.withFiles) {
      await fs.rm(book.folderPath, { recursive: true, force: false });
    } else {
      await fs.access(book.folderPath);
    }

    invalidateCoverPath(book.folderPath);
    const deleted = manga.deleteById(book.id);

    return ok({ deleted });
  });
}
