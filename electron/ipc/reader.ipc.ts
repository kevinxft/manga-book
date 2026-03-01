import fs from 'node:fs/promises';
import path from 'node:path';
import type { IpcContext } from './context';
import { registerHandler, ok, fail } from './helpers';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

export function registerReaderIpc(context: IpcContext): void {
  const { manga } = context.repositories;

  registerHandler('reader.listPages', async (request) => {
    const existing = manga.getById(request.mangaId);
    if (!existing) {
      return fail('NOT_FOUND', 'Manga not found');
    }

    try {
      const entries = await fs.readdir(existing.folderPath, { withFileTypes: true });
      const pagePaths = entries
        .filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
        .map((entry) => path.join(existing.folderPath, entry.name))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
      return ok(pagePaths);
    } catch (error) {
      return fail('FS_ERROR', error instanceof Error ? error.message : 'Failed to list manga pages');
    }
  });

  registerHandler('reader.saveProgress', (request) => {
    const existing = manga.getById(request.mangaId);
    if (!existing) {
      return fail('NOT_FOUND', 'Manga not found');
    }

    manga.updateProgress({
      mangaId: request.mangaId,
      chapterIndex: request.chapterIndex,
      pageIndex: request.pageIndex,
      totalPages: request.totalPages
    });

    return ok({ saved: true });
  });
}
