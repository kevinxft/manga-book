import path from 'node:path';
import Database from 'better-sqlite3';
import { app } from 'electron';
import { initializeSchema } from './schema';
import { createLibraryQueries } from './queries/library';
import { createSourceMetadataRepositories } from './sourceMetadata';

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

  const library = createLibraryQueries(db);
  const sourceRepositories = createSourceMetadataRepositories(library, db);

  return {
    db,
    library,
    ...sourceRepositories
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
