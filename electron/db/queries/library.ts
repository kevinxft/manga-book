import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { LibraryFolder, LibraryRoot } from '@shared/types';

interface LibraryFolderRow {
  id: string;
  path: string;
  display_name: string;
  added_at: string;
  is_target: number;
}

function mapRow(row: LibraryFolderRow): LibraryFolder {
  return {
    id: row.id,
    path: row.path,
    displayName: row.display_name,
    addedAt: row.added_at,
    isTarget: row.is_target === 1
  };
}

function mapRootRow(row: LibraryFolderRow): LibraryRoot {
  return {
    path: row.path,
    displayName: row.display_name,
    initializedAt: row.added_at,
    hasCustomIcon: row.is_target === 1
  };
}

export function createLibraryQueries(db: Database.Database) {
  const insertOrIgnoreStatement = db.prepare(
    `INSERT OR IGNORE INTO library_folders (id, path, display_name, added_at, is_target)
      VALUES (@id, @path, @display_name, @added_at, 0)`
  );
  const selectByPathStatement = db.prepare('SELECT * FROM library_folders WHERE path = ?');
  const selectByIdStatement = db.prepare('SELECT * FROM library_folders WHERE id = ?');
  const listStatement = db.prepare('SELECT * FROM library_folders ORDER BY added_at ASC');
  const removeStatement = db.prepare('DELETE FROM library_folders WHERE id = ?');
  const clearStatement = db.prepare('DELETE FROM library_folders');
  const clearTargetStatement = db.prepare('UPDATE library_folders SET is_target = 0');
  const setTargetStatement = db.prepare('UPDATE library_folders SET is_target = 1 WHERE id = ?');
  const insertRootStatement = db.prepare(
    `INSERT INTO library_folders (id, path, display_name, added_at, is_target)
      VALUES (@id, @path, @display_name, @added_at, @is_target)`
  );

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

  function setTarget(id: string | null): boolean {
    const transaction = db.transaction((targetId: string | null) => {
      clearTargetStatement.run();
      if (!targetId) {
        return true;
      }
      const result = setTargetStatement.run(targetId);
      return result.changes > 0;
    });

    return transaction(id);
  }

  function getRoot(): LibraryRoot | null {
    const row = (db.prepare('SELECT * FROM library_folders ORDER BY is_target DESC, added_at ASC LIMIT 1').get() ??
      null) as LibraryFolderRow | null;
    return row ? mapRootRow(row) : null;
  }

  function setRoot(path: string, displayName: string, options?: { hasCustomIcon?: boolean }): LibraryRoot {
    const now = new Date().toISOString();
    const transaction = db.transaction(() => {
      clearStatement.run();
      insertRootStatement.run({
        id: randomUUID(),
        path,
        display_name: displayName,
        added_at: now,
        is_target: options?.hasCustomIcon === false ? 0 : 1
      });
      const row = db.prepare('SELECT * FROM library_folders LIMIT 1').get() as LibraryFolderRow | undefined;
      if (!row) {
        throw new Error('Failed to save library root');
      }
      return mapRootRow(row);
    });

    return transaction();
  }

  function clear(): void {
    clearStatement.run();
  }

  return {
    add,
    getById,
    getByPath,
    list,
    remove,
    setTarget,
    getRoot,
    setRoot,
    clear
  };
}
