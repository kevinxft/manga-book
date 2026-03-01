import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { LibraryFolder } from '@shared/types';

interface LibraryFolderRow {
  id: string;
  path: string;
  display_name: string;
  added_at: string;
}

function mapRow(row: LibraryFolderRow): LibraryFolder {
  return {
    id: row.id,
    path: row.path,
    displayName: row.display_name,
    addedAt: row.added_at
  };
}

export function createLibraryQueries(db: Database.Database) {
  const insertOrIgnoreStatement = db.prepare(
    `INSERT OR IGNORE INTO library_folders (id, path, display_name, added_at)
      VALUES (@id, @path, @display_name, @added_at)`
  );
  const selectByPathStatement = db.prepare('SELECT * FROM library_folders WHERE path = ?');
  const selectByIdStatement = db.prepare('SELECT * FROM library_folders WHERE id = ?');
  const listStatement = db.prepare('SELECT * FROM library_folders ORDER BY added_at ASC');
  const removeStatement = db.prepare('DELETE FROM library_folders WHERE id = ?');

  function add(path: string, displayName: string): LibraryFolder {
    const now = new Date().toISOString();
    insertOrIgnoreStatement.run({
      id: randomUUID(),
      path,
      display_name: displayName,
      added_at: now
    });
    const row = selectByPathStatement.get(path) as LibraryFolderRow | undefined;
    if (!row) {
      throw new Error('Failed to add source folder');
    }
    return mapRow(row);
  }

  function getById(id: string): LibraryFolder | null {
    const row = selectByIdStatement.get(id) as LibraryFolderRow | undefined;
    return row ? mapRow(row) : null;
  }

  function getByPath(path: string): LibraryFolder | null {
    const row = selectByPathStatement.get(path) as LibraryFolderRow | undefined;
    return row ? mapRow(row) : null;
  }

  function list(): LibraryFolder[] {
    const rows = listStatement.all() as LibraryFolderRow[];
    return rows.map(mapRow);
  }

  function remove(id: string): boolean {
    const result = removeStatement.run(id);
    return result.changes > 0;
  }

  return {
    add,
    getById,
    getByPath,
    list,
    remove
  };
}
