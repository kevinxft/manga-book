import fs from 'node:fs/promises';
import path from 'node:path';
import type { IpcContext } from './context';
import { registerHandler, ok, fail } from './helpers';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

async function listImagePaths(directoryPath: string): Promise<string[]> {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => path.join(directoryPath, entry.name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
}

async function listMangaPagePaths(directoryPath: string, structure: 'singleVolume' | 'multiVolume'): Promise<string[]> {
  if (structure === 'multiVolume') {
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    const childDirectories = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(directoryPath, entry.name))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    const pagesByDirectory = await Promise.all(childDirectories.map((childDirectoryPath) => listImagePaths(childDirectoryPath)));
    return pagesByDirectory.flat();
  }

  return listImagePaths(directoryPath);
}

export function registerReaderIpc(context: IpcContext): void {
  const { manga } = context.repositories;

  registerHandler('reader.listPages', async (request) => {
    const existing = manga.getById(request.mangaId);
    if (!existing) {
      return fail('NOT_FOUND', 'Manga not found');
    }

    try {
      const pagePaths = await listMangaPagePaths(existing.folderPath, existing.structure);
      return ok(pagePaths);
    } catch (error) {
      return fail('FS_ERROR', error instanceof Error ? error.message : 'Failed to list manga pages');
    }
  });

  registerHandler('reader.deletePages', async (request) => {
    const existing = manga.getById(request.mangaId);
    if (!existing) {
      return fail('NOT_FOUND', 'Manga not found');
    }

    const requestedPagePaths = Array.from(
      new Set(
        request.pagePaths
          .map((pagePath) => pagePath.trim())
          .filter((pagePath) => pagePath.length > 0)
      )
    );

    if (requestedPagePaths.length === 0) {
      return fail('VALIDATION_ERROR', '请选择要删除的页面');
    }

    try {
      const currentPagePaths = await listMangaPagePaths(existing.folderPath, existing.structure);
      const pagePathSet = new Set(currentPagePaths);

      if (requestedPagePaths.some((pagePath) => !pagePathSet.has(pagePath))) {
        return fail('VALIDATION_ERROR', '包含不属于当前漫画的页面，无法删除');
      }

      if (requestedPagePaths.length >= currentPagePaths.length) {
        return fail('VALIDATION_ERROR', '至少需要保留 1 页漫画');
      }

      for (const pagePath of requestedPagePaths) {
        await fs.unlink(pagePath);
      }

      const remainingPageCount = currentPagePaths.length - requestedPagePaths.length;
      manga.updateProgress({
        mangaId: existing.id,
        chapterIndex: existing.lastChapterIndex,
        pageIndex: Math.min(existing.lastPageIndex, remainingPageCount - 1),
        totalPages: remainingPageCount
      });

      return ok({
        deletedCount: requestedPagePaths.length,
        totalPages: remainingPageCount
      });
    } catch (error) {
      return fail('FS_ERROR', error instanceof Error ? error.message : 'Failed to delete manga pages');
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
