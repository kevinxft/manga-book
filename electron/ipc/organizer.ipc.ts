import fs from 'node:fs/promises';
import path from 'node:path';
import { shell } from 'electron';
import trash from 'trash';
import type { IpcContext } from './context';
import { registerHandler, ok, fail } from './helpers';
import { ensureDirectory, movePath } from '@main/utils/fsUtils';
import { normalizeAbsolutePath } from '@main/utils/pathUtils';
import { invalidateCoverPath } from '@main/scanner/coverFinder';

export function registerOrganizerIpc(context: IpcContext): void {
  const { manga, alias } = context.repositories;

  registerHandler('organizer.moveManga', async (request) => {
    const book = manga.getById(request.mangaId);
    if (!book) {
      return fail('NOT_FOUND', 'Manga not found');
    }

    const destinationRoot = normalizeAbsolutePath(request.destinationPath);
    await ensureDirectory(destinationRoot);

    const nextFolderPath = path.join(destinationRoot, path.basename(book.folderPath));
    await movePath(book.folderPath, nextFolderPath);

    invalidateCoverPath(book.folderPath);
    const updated = manga.updatePath(book.id, path.basename(nextFolderPath), nextFolderPath);

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

    invalidateCoverPath(book.folderPath);
    const updated = manga.updatePath(book.id, request.newTitle, nextFolderPath);

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

  registerHandler('organizer.addAlias', async (request) => {
    const inputAlias = request.alias?.trim();
    const canonicalName = request.canonicalName?.trim();

    if (!inputAlias || !canonicalName) {
      return fail('VALIDATION', 'Alias and canonical name are required');
    }

    const stored = alias.insert(inputAlias, canonicalName);
    return ok(stored);
  });

  registerHandler('organizer.deleteManga', async (request) => {
    const book = manga.getById(request.mangaId);
    if (!book) {
      return fail('NOT_FOUND', 'Manga not found');
    }

    if (request.withFiles) {
      await trash([book.folderPath]);
    } else {
      await fs.access(book.folderPath);
    }

    invalidateCoverPath(book.folderPath);
    const deleted = manga.deleteById(book.id);

    return ok({ deleted });
  });
}
