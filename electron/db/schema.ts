import type Database from 'better-sqlite3';

const SCHEMA_VERSION = 2;

const DDL = [
  `CREATE TABLE IF NOT EXISTS manga_books (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    folder_path TEXT NOT NULL UNIQUE,
    source_folder_path TEXT NOT NULL,
    structure TEXT NOT NULL CHECK (structure IN ('singleVolume','multiVolume')),
    added_at TEXT NOT NULL,
    last_read_at TEXT,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    last_chapter_index INTEGER NOT NULL DEFAULT 0,
    last_page_index INTEGER NOT NULL DEFAULT 0,
    total_pages INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS library_folders (
    id TEXT PRIMARY KEY,
    path TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    added_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS manga_tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_key TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS manga_book_tags (
    manga_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (manga_id, tag_id),
    FOREIGN KEY (manga_id) REFERENCES manga_books(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES manga_tags(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS bookmarks (
    id TEXT PRIMARY KEY,
    manga_id TEXT NOT NULL,
    chapter_index INTEGER NOT NULL,
    page_index INTEGER NOT NULL,
    chapter_name TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY (manga_id) REFERENCES manga_books(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS directory_aliases (
    id TEXT PRIMARY KEY,
    alias TEXT NOT NULL,
    alias_key TEXT NOT NULL UNIQUE,
    canonical_name TEXT NOT NULL,
    canonical_key TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS organizer_directory_usage (
    directory_path TEXT PRIMARY KEY,
    last_moved_at TEXT NOT NULL,
    move_count INTEGER NOT NULL DEFAULT 0
  )`,
  'CREATE INDEX IF NOT EXISTS idx_books_source ON manga_books(source_folder_path)',
  'CREATE INDEX IF NOT EXISTS idx_books_title ON manga_books(title)',
  'CREATE INDEX IF NOT EXISTS idx_books_last_read ON manga_books(last_read_at)',
  'CREATE INDEX IF NOT EXISTS idx_bookmarks_manga ON bookmarks(manga_id)',
  'CREATE INDEX IF NOT EXISTS idx_aliases_canonical_key ON directory_aliases(canonical_key)',
  'CREATE INDEX IF NOT EXISTS idx_directory_usage_last_moved ON organizer_directory_usage(last_moved_at)'
];

export function initializeSchema(db: Database.Database): void {
  db.pragma('foreign_keys = ON');

  const currentVersion = db.pragma('user_version', { simple: true }) as number;

  if (currentVersion >= SCHEMA_VERSION) {
    return;
  }

  const migration = db.transaction(() => {
    for (const statement of DDL) {
      db.prepare(statement).run();
    }
    db.pragma(`user_version = ${SCHEMA_VERSION}`);
  });

  migration();
}
