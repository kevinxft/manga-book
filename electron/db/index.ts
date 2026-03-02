import path from 'node:path';
import Database from 'better-sqlite3';
import { app } from 'electron';
import { initializeSchema } from './schema';
import { createMangaQueries } from './queries/manga';
import { createLibraryQueries } from './queries/library';
import { createBookmarkQueries } from './queries/bookmark';
import { createTagQueries } from './queries/tag';
import { createAliasQueries } from './queries/alias';
import { createDirectoryUsageQueries } from './queries/directoryUsage';

let dbInstance: Database.Database | null = null;

function createDatabase(): Database.Database {
  const dbPath = path.join(app.getPath('userData'), 'mangabook.db');
  const db = new Database(dbPath);
  initializeSchema(db);
  return db;
}

export function getDatabase(): Database.Database {
  if (!dbInstance) {
    dbInstance = createDatabase();
  }
  return dbInstance;
}

export function createRepositories() {
  const db = getDatabase();

  const manga = createMangaQueries(db);
  const library = createLibraryQueries(db);
  const bookmark = createBookmarkQueries(db);
  const tag = createTagQueries(db);
  const alias = createAliasQueries(db);
  const directoryUsage = createDirectoryUsageQueries(db);

  return {
    db,
    manga,
    library,
    bookmark,
    tag,
    alias,
    directoryUsage
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
