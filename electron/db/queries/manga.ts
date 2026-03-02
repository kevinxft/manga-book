import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { MangaBook, MangaFilter, MangaStructure } from '@shared/types';

interface MangaBookRow {
  id: string;
  title: string;
  folder_path: string;
  source_folder_path: string;
  structure: MangaStructure;
  added_at: string;
  last_read_at: string | null;
  is_favorite: 0 | 1;
  last_chapter_index: number;
  last_page_index: number;
  total_pages: number;
}

function mapRow(row: MangaBookRow): MangaBook {
  return {
    id: row.id,
    title: row.title,
    folderPath: row.folder_path,
    sourceFolderPath: row.source_folder_path,
    structure: row.structure,
    addedAt: row.added_at,
    lastReadAt: row.last_read_at,
    isFavorite: row.is_favorite,
    lastChapterIndex: row.last_chapter_index,
    lastPageIndex: row.last_page_index,
    totalPages: row.total_pages
  };
}

export interface UpsertMangaInput {
  title: string;
  folderPath: string;
  sourceFolderPath: string;
  structure: MangaStructure;
  totalPages: number;
}

export function createMangaQueries(db: Database.Database) {
  const insertStatement = db.prepare(
    `INSERT INTO manga_books (
      id, title, folder_path, source_folder_path, structure, added_at,
      last_read_at, is_favorite, last_chapter_index, last_page_index, total_pages
    ) VALUES (
      @id, @title, @folder_path, @source_folder_path, @structure, @added_at,
      NULL, 0, 0, 0, @total_pages
    )`
  );

  const upsertStatement = db.prepare(
    `INSERT INTO manga_books (
      id, title, folder_path, source_folder_path, structure, added_at,
      last_read_at, is_favorite, last_chapter_index, last_page_index, total_pages
    ) VALUES (
      @id, @title, @folder_path, @source_folder_path, @structure, @added_at,
      NULL, 0, 0, 0, @total_pages
    )
    ON CONFLICT(folder_path) DO UPDATE SET
      title = excluded.title,
      source_folder_path = excluded.source_folder_path,
      structure = excluded.structure,
      total_pages = excluded.total_pages`
  );

  const byFolderPathStatement = db.prepare('SELECT * FROM manga_books WHERE folder_path = ?');
  const byIdStatement = db.prepare('SELECT * FROM manga_books WHERE id = ?');
  const deleteByFolderPathStatement = db.prepare('DELETE FROM manga_books WHERE folder_path = ?');
  const deleteBySourceStatement = db.prepare('DELETE FROM manga_books WHERE source_folder_path = ?');
  const deleteByIdStatement = db.prepare('DELETE FROM manga_books WHERE id = ?');
  const renamePathStatement = db.prepare(
    'UPDATE manga_books SET title = @title, folder_path = @folder_path, source_folder_path = @source_folder_path WHERE id = @id'
  );
  const movePathStatement = db.prepare(
    'UPDATE manga_books SET title = @title, folder_path = @folder_path, source_folder_path = @source_folder_path, added_at = @added_at WHERE id = @id'
  );
  const updateProgressStatement = db.prepare(
    `UPDATE manga_books SET
      last_chapter_index = @chapterIndex,
      last_page_index = @pageIndex,
      total_pages = @totalPages,
      last_read_at = @lastReadAt
    WHERE id = @mangaId`
  );

  const baseListSql = `SELECT * FROM manga_books`;

  function upsert(input: UpsertMangaInput): MangaBook {
    const now = new Date().toISOString();
    upsertStatement.run({
      id: randomUUID(),
      title: input.title,
      folder_path: input.folderPath,
      source_folder_path: input.sourceFolderPath,
      structure: input.structure,
      added_at: now,
      total_pages: input.totalPages
    });
    const row = byFolderPathStatement.get(input.folderPath) as MangaBookRow | undefined;
    if (!row) {
      throw new Error('Failed to upsert manga record');
    }
    return mapRow(row);
  }

  function insert(input: UpsertMangaInput): MangaBook {
    const now = new Date().toISOString();
    const id = randomUUID();
    insertStatement.run({
      id,
      title: input.title,
      folder_path: input.folderPath,
      source_folder_path: input.sourceFolderPath,
      structure: input.structure,
      added_at: now,
      total_pages: input.totalPages
    });
    const row = byIdStatement.get(id) as MangaBookRow | undefined;
    if (!row) {
      throw new Error('Failed to create manga record');
    }
    return mapRow(row);
  }

  function getById(id: string): MangaBook | null {
    const row = byIdStatement.get(id) as MangaBookRow | undefined;
    return row ? mapRow(row) : null;
  }

  function listBySource(sourceFolderPath: string): MangaBook[] {
    const rows = db
      .prepare('SELECT * FROM manga_books WHERE source_folder_path = ? ORDER BY added_at DESC')
      .all(sourceFolderPath) as MangaBookRow[];
    return rows.map(mapRow);
  }

  function list(filter?: MangaFilter): MangaBook[] {
    const whereClauses: string[] = [];
    const params: Record<string, unknown> = {};

    if (filter?.sourceFolderPaths?.length) {
      const placeholders = filter.sourceFolderPaths.map((_, index) => `@source${index}`);
      whereClauses.push(`source_folder_path IN (${placeholders.join(', ')})`);
      filter.sourceFolderPaths.forEach((path, index) => {
        params[`source${index}`] = path;
      });
    }

    if (filter?.query?.trim()) {
      whereClauses.push('(title LIKE @query OR folder_path LIKE @query)');
      params.query = `%${filter.query.trim()}%`;
    }

    const orderBy =
      filter?.sortBy === 'title'
        ? 'title COLLATE NOCASE ASC'
        : filter?.sortBy === 'lastReadAt'
          ? 'COALESCE(last_read_at, added_at) DESC'
          : 'added_at DESC';

    const sql = [
      baseListSql,
      whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '',
      `ORDER BY ${orderBy}`
    ]
      .filter(Boolean)
      .join(' ');

    const rows = db.prepare(sql).all(params) as MangaBookRow[];
    return rows.map(mapRow);
  }

  function updatePath(
    id: string,
    title: string,
    folderPath: string,
    sourceFolderPath: string,
    options?: {
      touchAddedAt?: boolean;
    }
  ): MangaBook {
    if (options?.touchAddedAt) {
      movePathStatement.run({
        id,
        title,
        folder_path: folderPath,
        source_folder_path: sourceFolderPath,
        added_at: new Date().toISOString()
      });
    } else {
      renamePathStatement.run({ id, title, folder_path: folderPath, source_folder_path: sourceFolderPath });
    }

    const row = byIdStatement.get(id) as MangaBookRow | undefined;
    if (!row) {
      throw new Error('Manga not found after update');
    }
    return mapRow(row);
  }

  function updateProgress(input: {
    mangaId: string;
    chapterIndex: number;
    pageIndex: number;
    totalPages: number;
  }): void {
    updateProgressStatement.run({
      mangaId: input.mangaId,
      chapterIndex: input.chapterIndex,
      pageIndex: input.pageIndex,
      totalPages: input.totalPages,
      lastReadAt: new Date().toISOString()
    });
  }

  function deleteByFolderPath(folderPath: string): void {
    deleteByFolderPathStatement.run(folderPath);
  }

  function deleteBySource(sourceFolderPath: string): void {
    deleteBySourceStatement.run(sourceFolderPath);
  }

  function deleteById(id: string): boolean {
    const result = deleteByIdStatement.run(id);
    return result.changes > 0;
  }

  return {
    insert,
    upsert,
    getById,
    updatePath,
    updateProgress,
    deleteByFolderPath,
    deleteBySource,
    deleteById,
    listBySource,
    list
  };
}
