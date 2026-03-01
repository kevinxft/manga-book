import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { Bookmark } from '@shared/types';

interface BookmarkRow {
  id: string;
  manga_id: string;
  chapter_index: number;
  page_index: number;
  chapter_name: string;
  title: string;
  note: string;
  created_at: string;
}

function mapRow(row: BookmarkRow): Bookmark {
  return {
    id: row.id,
    mangaId: row.manga_id,
    chapterIndex: row.chapter_index,
    pageIndex: row.page_index,
    chapterName: row.chapter_name,
    title: row.title,
    note: row.note,
    createdAt: row.created_at
  };
}

export function createBookmarkQueries(db: Database.Database) {
  const insertStatement = db.prepare(
    `INSERT INTO bookmarks (
      id, manga_id, chapter_index, page_index, chapter_name, title, note, created_at
    ) VALUES (
      @id, @manga_id, @chapter_index, @page_index, @chapter_name, @title, @note, @created_at
    )`
  );

  const updateStatement = db.prepare('UPDATE bookmarks SET title = @title, note = @note WHERE id = @id');
  const deleteStatement = db.prepare('DELETE FROM bookmarks WHERE id = ?');
  const listByMangaStatement = db.prepare(
    `SELECT * FROM bookmarks WHERE manga_id = ? ORDER BY created_at DESC`
  );
  const getByIdStatement = db.prepare('SELECT * FROM bookmarks WHERE id = ?');

  function insert(input: {
    mangaId: string;
    chapterIndex: number;
    pageIndex: number;
    title?: string;
    note?: string;
  }): Bookmark {
    const id = randomUUID();
    const now = new Date().toISOString();
    insertStatement.run({
      id,
      manga_id: input.mangaId,
      chapter_index: input.chapterIndex,
      page_index: input.pageIndex,
      chapter_name: '',
      title: input.title ?? '',
      note: input.note ?? '',
      created_at: now
    });

    const row = getByIdStatement.get(id) as BookmarkRow | undefined;
    if (!row) {
      throw new Error('Failed to create bookmark');
    }
    return mapRow(row);
  }

  function update(id: string, title: string, note: string): Bookmark {
    updateStatement.run({ id, title, note });
    const row = getByIdStatement.get(id) as BookmarkRow | undefined;
    if (!row) {
      throw new Error('Bookmark not found');
    }
    return mapRow(row);
  }

  function remove(id: string): boolean {
    const result = deleteStatement.run(id);
    return result.changes > 0;
  }

  function listByManga(mangaId: string): Bookmark[] {
    const rows = listByMangaStatement.all(mangaId) as BookmarkRow[];
    return rows.map(mapRow);
  }

  return {
    insert,
    update,
    remove,
    listByManga
  };
}
