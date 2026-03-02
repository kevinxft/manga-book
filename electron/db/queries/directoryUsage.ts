import type Database from 'better-sqlite3';

export interface DirectoryUsageRecord {
  directoryPath: string;
  lastMovedAt: string;
  moveCount: number;
}

interface DirectoryUsageRow {
  directory_path: string;
  last_moved_at: string;
  move_count: number;
}

function mapRow(row: DirectoryUsageRow): DirectoryUsageRecord {
  return {
    directoryPath: row.directory_path,
    lastMovedAt: row.last_moved_at,
    moveCount: row.move_count
  };
}

export function createDirectoryUsageQueries(db: Database.Database) {
  const touchStatement = db.prepare(
    `INSERT INTO organizer_directory_usage (directory_path, last_moved_at, move_count)
      VALUES (@directory_path, @last_moved_at, 1)
      ON CONFLICT(directory_path) DO UPDATE SET
        last_moved_at = excluded.last_moved_at,
        move_count = organizer_directory_usage.move_count + 1`
  );
  const listByPathsStatement = db.prepare(
    `SELECT directory_path, last_moved_at, move_count
      FROM organizer_directory_usage
      WHERE directory_path IN (SELECT value FROM json_each(?))`
  );

  function touch(directoryPath: string): DirectoryUsageRecord {
    const now = new Date().toISOString();
    touchStatement.run({
      directory_path: directoryPath,
      last_moved_at: now
    });

    const row = db
      .prepare(
        'SELECT directory_path, last_moved_at, move_count FROM organizer_directory_usage WHERE directory_path = ? LIMIT 1'
      )
      .get(directoryPath) as DirectoryUsageRow | undefined;

    if (!row) {
      throw new Error('Failed to update directory usage');
    }

    return mapRow(row);
  }

  function listByPaths(paths: string[]): DirectoryUsageRecord[] {
    if (paths.length === 0) {
      return [];
    }

    const rows = listByPathsStatement.all(JSON.stringify(paths)) as DirectoryUsageRow[];
    return rows.map(mapRow);
  }

  return {
    touch,
    listByPaths
  };
}
