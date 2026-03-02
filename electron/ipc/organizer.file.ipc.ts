import fs from 'node:fs/promises';
import path from 'node:path';
import { shell } from 'electron';
import type { IpcContext } from './context';
import { fail, ok, registerHandler } from './helpers';
import { listArtistsRoots, resolveSourceFolderPath } from './organizer.common';
import { directoryExists, ensureDirectory, listDirectories, movePath } from '@main/utils/fsUtils';
import { normalizeAbsolutePath } from '@main/utils/pathUtils';
import { invalidateCoverPath } from '@main/scanner/coverFinder';

export function registerOrganizerFileIpc(context: IpcContext): void {
  const { manga, library, directoryUsage } = context.repositories;

  registerHandler('organizer.moveManga', async (request) => {
    const book = manga.getById(request.mangaId);
    if (!book) {
      return fail('NOT_FOUND', 'Manga not found');
    }

    const destinationRoot = normalizeAbsolutePath(request.destinationPath);
    await ensureDirectory(destinationRoot);

    const nextFolderPath = path.join(destinationRoot, path.basename(book.folderPath));
    await movePath(book.folderPath, nextFolderPath);

    const sourcePaths = library.list().map((source) => source.path);
    const nextSourceFolderPath = resolveSourceFolderPath(nextFolderPath, sourcePaths, book.sourceFolderPath);

    invalidateCoverPath(book.folderPath);
    const updated = manga.updatePath(book.id, path.basename(nextFolderPath), nextFolderPath, nextSourceFolderPath, {
      touchAddedAt: true
    });
    directoryUsage.touch(destinationRoot);

    return ok(updated);
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

    for (const rootPath of artistsRoots) {
      if (!(await directoryExists(rootPath))) {
        continue;
      }
      const children = await listDirectories(rootPath);
      for (const childPath of children) {
        directories.push(normalizeAbsolutePath(childPath));
      }
    }

    const mangaBooks = manga.list();
    const uniqueDirectories = Array.from(new Set(directories)).sort((a, b) => a.localeCompare(b));
    const usageByPath = new Map(
      directoryUsage.listByPaths(uniqueDirectories).map((item) => [normalizeAbsolutePath(item.directoryPath), item.lastMovedAt])
    );
    const summaries = uniqueDirectories.map((directory) => {
      const normalizedDirectory = normalizeAbsolutePath(directory);
      const prefix = `${normalizedDirectory}${path.sep}`;
      const mangaCount = mangaBooks.filter((book) => book.folderPath.startsWith(prefix)).length;
      return {
        directory: normalizedDirectory,
        mangaCount,
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
      return fail('NO_TARGET_ROOT', 'No Artists root found. Please import organizer root first.');
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
