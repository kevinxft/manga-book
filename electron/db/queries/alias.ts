import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { DirectoryAlias } from '@shared/types';
import { toKey } from '@main/utils/pathUtils';

interface DirectoryAliasRow {
  id: string;
  alias: string;
  canonical_name: string;
  created_at: string;
}

function mapRow(row: DirectoryAliasRow): DirectoryAlias {
  return {
    id: row.id,
    alias: row.alias,
    canonicalName: row.canonical_name,
    createdAt: row.created_at
  };
}

export function createAliasQueries(db: Database.Database) {
  const insertStatement = db.prepare(
    `INSERT INTO directory_aliases (id, alias, alias_key, canonical_name, canonical_key, created_at)
      VALUES (@id, @alias, @alias_key, @canonical_name, @canonical_key, @created_at)
      ON CONFLICT(alias_key) DO UPDATE SET
        alias = excluded.alias,
        canonical_name = excluded.canonical_name,
        canonical_key = excluded.canonical_key`
  );

  const resolveStatement = db.prepare(
    'SELECT canonical_name FROM directory_aliases WHERE alias_key = ? LIMIT 1'
  );
  const listStatement = db.prepare('SELECT * FROM directory_aliases ORDER BY alias ASC');

  function insert(alias: string, canonicalName: string): DirectoryAlias {
    const now = new Date().toISOString();
    insertStatement.run({
      id: randomUUID(),
      alias,
      alias_key: toKey(alias),
      canonical_name: canonicalName,
      canonical_key: toKey(canonicalName),
      created_at: now
    });

    const row = db
      .prepare('SELECT * FROM directory_aliases WHERE alias_key = ?')
      .get(toKey(alias)) as DirectoryAliasRow | undefined;
    if (!row) {
      throw new Error('Failed to store alias');
    }

    return mapRow(row);
  }

  function resolve(name: string): string {
    const row = resolveStatement.get(toKey(name)) as
      | {
          canonical_name: string;
        }
      | undefined;
    return row?.canonical_name ?? name;
  }

  function list(): DirectoryAlias[] {
    const rows = listStatement.all() as DirectoryAliasRow[];
    return rows.map(mapRow);
  }

  return {
    insert,
    resolve,
    list
  };
}
