import fs from 'node:fs/promises';
import { isSupportedImageFile } from '@main/utils/imageFiles';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { shell } from 'electron';
import type { MangaBook, ReaderChapter } from '@shared/types';
import type { IpcContext } from './context';
import { registerHandler, ok, fail } from './helpers';

const READER_MANUAL_CHAPTERS_KEY_PREFIX = 'reader_manual_chapters:';
const MAX_CHAPTER_TITLE_LENGTH = 120;
const READER_CHAPTER_METADATA_KEY_PREFIX = 'reader_chapter_metadata:';

async function listImagePaths(directoryPath: string): Promise<string[]> {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && isSupportedImageFile(entry.name))
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

function normalizeRelativePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
}

function getManualChapterMetadataKey(mangaId: string): string {
  return `${READER_MANUAL_CHAPTERS_KEY_PREFIX}${mangaId}`;
}

function getChapterMetadataKey(mangaId: string): string {
  return `${READER_CHAPTER_METADATA_KEY_PREFIX}${mangaId}`;
}

type StoredManualChapter = {
  id: string;
  startPageRelativePath: string;
  createdAt: string;
};

type StoredChapterMetadata = {
  id: string;
  title: string | null;
  highlighted: boolean;
  updatedAt: string;
};

type ReaderChapterBase = Omit<ReaderChapter, 'highlighted'>;

function readStoredManualChapters(db: Database.Database, mangaId: string): StoredManualChapter[] {
  const row = db.prepare('SELECT value FROM source_metadata WHERE key = ? LIMIT 1').get(getManualChapterMetadataKey(mangaId)) as
    | { value: string }
    | undefined;
  if (!row?.value) {
    return [];
  }

  try {
    const parsed = JSON.parse(row.value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return null;
        }
        const candidate = item as Partial<StoredManualChapter>;
        const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
        const startPageRelativePath =
          typeof candidate.startPageRelativePath === 'string' ? normalizeRelativePath(candidate.startPageRelativePath) : '';
        const createdAt = typeof candidate.createdAt === 'string' ? candidate.createdAt : '';
        if (!id || !startPageRelativePath) {
          return null;
        }
        return { id, startPageRelativePath, createdAt };
      })
      .filter((item): item is StoredManualChapter => Boolean(item));
  } catch {
    return [];
  }
}

function writeStoredManualChapters(
  db: Database.Database,
  mangaId: string,
  chapters: StoredManualChapter[]
): void {
  const key = getManualChapterMetadataKey(mangaId);

  if (chapters.length === 0) {
    db.prepare('DELETE FROM source_metadata WHERE key = ?').run(key);
    return;
  }

  db.prepare(
    `INSERT INTO source_metadata (key, value, updated_at)
      VALUES (@key, @value, @updated_at)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run({
    key,
    value: JSON.stringify(chapters),
    updated_at: new Date().toISOString()
  });
}

function normalizeChapterTitle(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, MAX_CHAPTER_TITLE_LENGTH);
}

function readStoredChapterMetadata(db: Database.Database, mangaId: string): StoredChapterMetadata[] {
  const row = db.prepare('SELECT value FROM source_metadata WHERE key = ? LIMIT 1').get(getChapterMetadataKey(mangaId)) as
    | { value: string }
    | undefined;
  if (!row?.value) {
    return [];
  }

  try {
    const parsed = JSON.parse(row.value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return null;
        }

        const candidate = item as Partial<StoredChapterMetadata>;
        const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
        if (!id) {
          return null;
        }

        return {
          id,
          title: normalizeChapterTitle(candidate.title),
          highlighted: candidate.highlighted === true,
          updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : ''
        };
      })
      .filter((item): item is StoredChapterMetadata => Boolean(item));
  } catch {
    return [];
  }
}

function writeStoredChapterMetadata(
  db: Database.Database,
  mangaId: string,
  items: StoredChapterMetadata[]
): void {
  const key = getChapterMetadataKey(mangaId);
  const normalized = items
    .map((item) => ({
      id: item.id.trim(),
      title: normalizeChapterTitle(item.title),
      highlighted: item.highlighted === true,
      updatedAt: item.updatedAt || new Date().toISOString()
    }))
    .filter((item) => item.id.length > 0)
    .filter((item) => item.title !== null || item.highlighted);

  if (normalized.length === 0) {
    db.prepare('DELETE FROM source_metadata WHERE key = ?').run(key);
    return;
  }

  db.prepare(
    `INSERT INTO source_metadata (key, value, updated_at)
      VALUES (@key, @value, @updated_at)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run({
    key,
    value: JSON.stringify(normalized),
    updated_at: new Date().toISOString()
  });
}

async function listBaseReaderChaptersForManga(
  manga: MangaBook,
  canEditManualChapters: boolean,
  sourceMetadata: IpcContext['repositories']['sourceMetadata']
): Promise<ReaderChapterBase[]> {
  if (manga.structure === 'multiVolume') {
    const entries = await fs.readdir(manga.folderPath, { withFileTypes: true });
    const childDirectories = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(manga.folderPath, entry.name))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    const chapters: ReaderChapterBase[] = [];
    let startPageIndex = 0;

    for (const childDirectoryPath of childDirectories) {
      const pagePaths = await listImagePaths(childDirectoryPath);
      if (pagePaths.length === 0) {
        continue;
      }

      chapters.push({
        id: `filesystem:${normalizeRelativePath(path.relative(manga.folderPath, childDirectoryPath))}`,
        title: path.basename(childDirectoryPath),
        startPageIndex,
        endPageIndex: startPageIndex + pagePaths.length - 1,
        pageCount: pagePaths.length,
        source: 'filesystem',
        deletable: false
      });
      startPageIndex += pagePaths.length;
    }

    return chapters;
  }

  const pagePaths = await listImagePaths(manga.folderPath);
  const handle = sourceMetadata.ensureSourceMetadataDb(manga.sourceFolderPath);
  const storedChapters = readStoredManualChapters(handle.db, manga.id);
  if (storedChapters.length === 0 || pagePaths.length === 0) {
    return [];
  }

  const pageIndexByRelativePath = new Map(
    pagePaths.map((pagePath, index) => [normalizeRelativePath(path.relative(manga.folderPath, pagePath)), index] as const)
  );

  const validBoundaries = Array.from(
    new Map(
      storedChapters
        .map((chapter) => {
          const pageIndex = pageIndexByRelativePath.get(chapter.startPageRelativePath);
          if (typeof pageIndex !== 'number') {
            return null;
          }
          return [pageIndex, { ...chapter, pageIndex }] as const;
        })
        .filter((item): item is readonly [number, StoredManualChapter & { pageIndex: number }] => Boolean(item))
    ).values()
  ).sort((a, b) => a.pageIndex - b.pageIndex);

  if (validBoundaries.length === 0) {
    return [];
  }

  const starts = validBoundaries.some((chapter) => chapter.pageIndex === 0)
    ? validBoundaries
    : [{ id: 'generated:start', startPageRelativePath: '', createdAt: '', pageIndex: 0 }, ...validBoundaries];

  return starts.map((chapter, index) => {
    const nextStart = starts[index + 1]?.pageIndex ?? pagePaths.length;
    const startPageIndex = chapter.pageIndex;
    const endPageIndex = Math.max(startPageIndex, nextStart - 1);

    return {
      id: chapter.id,
      title: `第 ${index + 1} 章`,
      startPageIndex,
      endPageIndex,
      pageCount: endPageIndex - startPageIndex + 1,
      source: chapter.id.startsWith('generated:') ? 'generated' : 'manual',
      deletable: canEditManualChapters && !chapter.id.startsWith('generated:')
    };
  });
}

function applyChapterMetadata(chapters: ReaderChapterBase[], items: StoredChapterMetadata[]): ReaderChapter[] {
  const metadataById = new Map(items.map((item) => [item.id, item]));

  return chapters.map((chapter) => {
    const metadata = metadataById.get(chapter.id);
    return {
      ...chapter,
      title: metadata?.title ?? chapter.title,
      highlighted: metadata?.highlighted === true
    };
  });
}

async function listReaderChaptersForManga(
  manga: MangaBook,
  sourceMetadata: IpcContext['repositories']['sourceMetadata'],
  canEditManualChapters: boolean
): Promise<ReaderChapter[]> {
  const baseChapters = await listBaseReaderChaptersForManga(manga, canEditManualChapters, sourceMetadata);
  if (baseChapters.length === 0) {
    return [];
  }

  const handle = sourceMetadata.ensureSourceMetadataDb(manga.sourceFolderPath);
  const storedMetadata = readStoredChapterMetadata(handle.db, manga.id);
  return applyChapterMetadata(baseChapters, storedMetadata);
}

function upsertChapterMetadataItem(
  items: StoredChapterMetadata[],
  input: { id: string; title: string | null; highlighted: boolean }
): StoredChapterMetadata[] {
  const nextItems = items.filter((item) => item.id !== input.id);

  if (input.title === null && !input.highlighted) {
    return nextItems;
  }

  nextItems.push({
    id: input.id,
    title: input.title,
    highlighted: input.highlighted,
    updatedAt: new Date().toISOString()
  });
  return nextItems;
}

export function registerReaderIpc(context: IpcContext): void {
  const { manga, sourceMetadata } = context.repositories;

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

  registerHandler('reader.listChapters', async (request) => {
    const existing = manga.getById(request.mangaId);
    if (!existing) {
      return fail('NOT_FOUND', 'Manga not found');
    }

    try {
      const chapters = await listReaderChaptersForManga(existing, sourceMetadata, true);
      return ok(chapters);
    } catch (error) {
      return fail('FS_ERROR', error instanceof Error ? error.message : 'Failed to list manga chapters');
    }
  });

  registerHandler('reader.addChapter', async (request) => {
    const existing = manga.getById(request.mangaId);
    if (!existing) {
      return fail('NOT_FOUND', 'Manga not found');
    }
    if (existing.structure !== 'singleVolume') {
      return fail('UNSUPPORTED', '当前漫画已按目录分章节，暂不支持在阅读页新增章节。');
    }

    try {
      const pagePaths = await listImagePaths(existing.folderPath);
      if (pagePaths.length === 0) {
        return fail('VALIDATION_ERROR', '当前漫画没有可分章的页面。');
      }

      const pageIndex = Math.trunc(request.pageIndex);
      if (!Number.isFinite(pageIndex) || pageIndex < 0 || pageIndex >= pagePaths.length) {
        return fail('VALIDATION_ERROR', '章节起始页无效。');
      }
      if (pageIndex === 0) {
        return fail('VALIDATION_ERROR', '第一页已经是默认起点，不需要再新增章节。');
      }

      const handle = sourceMetadata.ensureSourceMetadataDb(existing.sourceFolderPath);
      const storedChapters = readStoredManualChapters(handle.db, existing.id);
      const startPagePath = pagePaths[pageIndex];
      if (!startPagePath) {
        return fail('VALIDATION_ERROR', '章节起始页无效。');
      }
      const startPageRelativePath = normalizeRelativePath(path.relative(existing.folderPath, startPagePath));
      if (storedChapters.some((chapter) => chapter.startPageRelativePath === startPageRelativePath)) {
        return fail('CONFLICT', '当前页已经是章节起点。');
      }

      storedChapters.push({
        id: randomUUID(),
        startPageRelativePath,
        createdAt: new Date().toISOString()
      });
      writeStoredManualChapters(handle.db, existing.id, storedChapters);

      return ok(await listReaderChaptersForManga(existing, sourceMetadata, true));
    } catch (error) {
      return fail('FS_ERROR', error instanceof Error ? error.message : 'Failed to add manga chapter');
    }
  });

  registerHandler('reader.removeChapter', async (request) => {
    const existing = manga.getById(request.mangaId);
    if (!existing) {
      return fail('NOT_FOUND', 'Manga not found');
    }
    if (existing.structure !== 'singleVolume') {
      return fail('UNSUPPORTED', '当前漫画已按目录分章节，暂不支持删除章节。');
    }

    const chapterId = request.chapterId?.trim();
    if (!chapterId || chapterId.startsWith('generated:')) {
      return fail('VALIDATION_ERROR', '该章节不能删除。');
    }

    try {
      const handle = sourceMetadata.ensureSourceMetadataDb(existing.sourceFolderPath);
      const storedChapters = readStoredManualChapters(handle.db, existing.id);
      const nextChapters = storedChapters.filter((chapter) => chapter.id !== chapterId);
      if (nextChapters.length === storedChapters.length) {
        return fail('NOT_FOUND', 'Chapter not found');
      }

      writeStoredManualChapters(handle.db, existing.id, nextChapters);
      writeStoredChapterMetadata(
        handle.db,
        existing.id,
        readStoredChapterMetadata(handle.db, existing.id).filter((item) => item.id !== chapterId)
      );
      return ok(await listReaderChaptersForManga(existing, sourceMetadata, true));
    } catch (error) {
      return fail('FS_ERROR', error instanceof Error ? error.message : 'Failed to remove manga chapter');
    }
  });

  registerHandler('reader.updateChapter', async (request) => {
    const existing = manga.getById(request.mangaId);
    if (!existing) {
      return fail('NOT_FOUND', 'Manga not found');
    }

    const chapterId = request.chapterId?.trim();
    if (!chapterId) {
      return fail('VALIDATION_ERROR', '章节标识无效。');
    }

    const hasTitleUpdate = Object.prototype.hasOwnProperty.call(request, 'title');
    const hasHighlightUpdate = typeof request.highlighted === 'boolean';
    if (!hasTitleUpdate && !hasHighlightUpdate) {
      return fail('VALIDATION_ERROR', '未提供章节更新内容。');
    }

    try {
      const baseChapters = await listBaseReaderChaptersForManga(existing, true, sourceMetadata);
      const targetChapter = baseChapters.find((chapter) => chapter.id === chapterId);
      if (!targetChapter) {
        return fail('NOT_FOUND', 'Chapter not found');
      }

      const handle = sourceMetadata.ensureSourceMetadataDb(existing.sourceFolderPath);
      const storedMetadata = readStoredChapterMetadata(handle.db, existing.id);
      const currentMetadata = storedMetadata.find((item) => item.id === chapterId);

      const nextTitleInput = hasTitleUpdate ? normalizeChapterTitle(request.title) : currentMetadata?.title ?? null;
      const nextTitle = nextTitleInput === targetChapter.title ? null : nextTitleInput;
      const nextHighlighted = hasHighlightUpdate ? request.highlighted === true : currentMetadata?.highlighted === true;

      writeStoredChapterMetadata(
        handle.db,
        existing.id,
        upsertChapterMetadataItem(storedMetadata, {
          id: chapterId,
          title: nextTitle,
          highlighted: nextHighlighted
        })
      );

      return ok(await listReaderChaptersForManga(existing, sourceMetadata, true));
    } catch (error) {
      return fail('FS_ERROR', error instanceof Error ? error.message : 'Failed to update manga chapter');
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
        await shell.trashItem(pagePath);
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
