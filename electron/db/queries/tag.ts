import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { MangaTag, TagAddToMangaResult } from '@shared/types';
import { toKey } from '@main/utils/pathUtils';

interface MangaTagRow {
  id: string;
  name: string;
  created_at: string;
}

function mapRow(row: MangaTagRow): MangaTag {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at
  };
}

export function createTagQueries(db: Database.Database) {
  const upsertStatement = db.prepare(
    `INSERT INTO manga_tags (id, name, name_key, created_at)
      VALUES (@id, @name, @name_key, @created_at)
      ON CONFLICT(name_key) DO UPDATE SET name = excluded.name`
  );

  const selectByKeyStatement = db.prepare('SELECT * FROM manga_tags WHERE name_key = ?');
  const listStatement = db.prepare('SELECT id, name, created_at FROM manga_tags ORDER BY name COLLATE NOCASE ASC');
  const listByMangaStatement = db.prepare(
    `SELECT t.id, t.name, t.created_at
      FROM manga_tags t
      JOIN manga_book_tags mbt ON mbt.tag_id = t.id
      WHERE mbt.manga_id = ?
      ORDER BY t.name COLLATE NOCASE ASC`
  );
  const linkToMangaStatement = db.prepare(
    `INSERT OR IGNORE INTO manga_book_tags (manga_id, tag_id, created_at)
      VALUES (@manga_id, @tag_id, @created_at)`
  );

  const deleteOrphanStatement = db.prepare(
    `DELETE FROM manga_tags
      WHERE id IN (
        SELECT t.id
        FROM manga_tags t
        LEFT JOIN manga_book_tags mbt ON mbt.tag_id = t.id
        GROUP BY t.id
        HAVING COUNT(mbt.tag_id) = 0
      )`
  );
  const deleteByIdStatement = db.prepare('DELETE FROM manga_tags WHERE id = ?');

  function upsert(name: string): MangaTag {
    const nameKey = toKey(name);
    const now = new Date().toISOString();
    upsertStatement.run({ id: randomUUID(), name, name_key: nameKey, created_at: now });
    const row = selectByKeyStatement.get(nameKey) as MangaTagRow | undefined;
    if (!row) {
      throw new Error('Failed to upsert tag');
    }
    return mapRow(row);
  }

  function listByManga(mangaId: string): MangaTag[] {
    const rows = listByMangaStatement.all(mangaId) as MangaTagRow[];
    return rows.map(mapRow);
  }

  function list(): MangaTag[] {
    const rows = listStatement.all() as MangaTagRow[];
    return rows.map(mapRow);
  }

  function addToManga(mangaId: string, tagName: string): TagAddToMangaResult {
    const tag = upsert(tagName);
    const result = linkToMangaStatement.run({
      manga_id: mangaId,
      tag_id: tag.id,
      created_at: new Date().toISOString()
    });
    return {
      tag,
      linked: result.changes > 0
    };
  }

  function deleteOrphan(): number {
    const result = deleteOrphanStatement.run();
    return result.changes;
  }

  function removeById(id: string): boolean {
    const result = deleteByIdStatement.run(id);
    return result.changes > 0;
  }

  return {
    upsert,
    list,
    listByManga,
    addToManga,
    deleteOrphan,
    removeById
  };
}
