/* eslint-disable @typescript-eslint/no-this-alias */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import type {
  Bookmark,
  DirectoryAlias,
  MangaBook,
  MangaFilter,
  MangaStructure,
  MangaTag,
  TagAddToMangaResult
} from '@shared/types';
import { normalizeAbsolutePath, toKey } from '@main/utils/pathUtils';
import type { createLibraryQueries } from './queries/library';

const SOURCE_METADATA_DIRNAME = '.mangabook';
const SOURCE_METADATA_DB_FILENAME = 'metadata.db';
const SOURCE_SCHEMA_VERSION = 1;
const AUTHOR_ALIAS_METADATA_FILENAME = '.mangabook-author.json';
const ARTISTS_DIRECTORY_NAME = 'artists';
const METADATA_KEYS = {
  legacyMigrationComplete: 'legacy_migration_complete',
  authorFileImportComplete: 'author_file_import_complete'
} as const;

interface SourceMangaRow {
  id: string;
  title: string;
  relative_path: string;
  structure: MangaStructure;
  added_at: string;
  last_read_at: string | null;
  is_favorite: 0 | 1;
  last_chapter_index: number;
  last_page_index: number;
  total_pages: number;
}

interface SourceTagRow {
  id: string;
  name: string;
  name_key: string;
  created_at: string;
}

interface SourceBookmarkRow {
  id: string;
  manga_id: string;
  chapter_index: number;
  page_index: number;
  chapter_name: string;
  title: string;
  note: string;
  created_at: string;
}

interface SourceAliasRow {
  id: string;
  alias: string;
  alias_key: string;
  canonical_name: string;
  canonical_key: string;
  created_at: string;
}

interface SourceDirectoryUsageRow {
  directory_relative_path: string;
  last_moved_at: string;
  move_count: number;
}

interface SourceMetadataValueRow {
  key: string;
  value: string;
}

interface SourceAuthorAliasMetadata {
  canonicalName: string;
  aliases: string[];
  updatedAt: string;
}

interface SourceDbHandle {
  rootPath: string;
  dbPath: string;
  db: Database.Database;
}

type LibraryRegistry = ReturnType<typeof createLibraryQueries>;

function normalizeStoredRelativePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
}

function toRelativePath(rootPath: string, absolutePath: string): string {
  const normalizedRootPath = normalizeAbsolutePath(rootPath);
  const normalizedAbsolutePath = normalizeAbsolutePath(absolutePath);
  const relativePath = normalizeStoredRelativePath(path.relative(normalizedRootPath, normalizedAbsolutePath));
  if (!relativePath || relativePath === '.' || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Path ${normalizedAbsolutePath} is outside source root ${normalizedRootPath}`);
  }
  return relativePath;
}

function toAbsolutePath(rootPath: string, relativePath: string): string {
  return normalizeAbsolutePath(path.join(rootPath, relativePath));
}

function getSourceMetadataDirectoryPath(rootPath: string): string {
  return path.join(normalizeAbsolutePath(rootPath), SOURCE_METADATA_DIRNAME);
}

function getSourceMetadataDbPath(rootPath: string): string {
  return path.join(getSourceMetadataDirectoryPath(rootPath), SOURCE_METADATA_DB_FILENAME);
}

function ensureSourceMetadataDirectory(rootPath: string): void {
  fs.mkdirSync(getSourceMetadataDirectoryPath(rootPath), { recursive: true });
}

function isMetadataDirectoryPath(directoryPath: string): boolean {
  return path.basename(directoryPath) === SOURCE_METADATA_DIRNAME;
}

function listChildDirectories(rootPath: string): string[] {
  try {
    return fs
      .readdirSync(rootPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== SOURCE_METADATA_DIRNAME)
      .map((entry) => normalizeAbsolutePath(path.join(rootPath, entry.name)));
  } catch {
    return [];
  }
}

function findArtistsDirectoryPathSync(candidatePath: string): string | null {
  const normalizedCandidatePath = normalizeAbsolutePath(candidatePath);
  const match = listChildDirectories(normalizedCandidatePath).find(
    (childPath) => path.basename(childPath).toLowerCase() === ARTISTS_DIRECTORY_NAME
  );
  return match ?? null;
}

function mapMangaRow(row: SourceMangaRow, rootPath: string): MangaBook {
  return {
    id: row.id,
    title: row.title,
    folderPath: toAbsolutePath(rootPath, row.relative_path),
    sourceFolderPath: rootPath,
    structure: row.structure,
    addedAt: row.added_at,
    lastReadAt: row.last_read_at,
    isFavorite: row.is_favorite,
    lastChapterIndex: row.last_chapter_index,
    lastPageIndex: row.last_page_index,
    totalPages: row.total_pages
  };
}

function mapTagRow(row: SourceTagRow): MangaTag {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at
  };
}

function mapBookmarkRow(row: SourceBookmarkRow): Bookmark {
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

function mapAliasRow(row: SourceAliasRow): DirectoryAlias {
  return {
    id: row.id,
    alias: row.alias,
    canonicalName: row.canonical_name,
    createdAt: row.created_at
  };
}

function getDeterministicTagId(tagName: string): string {
  return `tag:${toKey(tagName)}`;
}

function initializeSourceSchema(db: Database.Database): void {
  db.pragma('foreign_keys = ON');

  const currentVersion = db.pragma('user_version', { simple: true }) as number;
  if (currentVersion >= SOURCE_SCHEMA_VERSION) {
    return;
  }

  const migration = db.transaction(() => {
    db.prepare(
      `CREATE TABLE IF NOT EXISTS manga_books (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        relative_path TEXT NOT NULL UNIQUE,
        structure TEXT NOT NULL CHECK (structure IN ('singleVolume','multiVolume')),
        added_at TEXT NOT NULL,
        last_read_at TEXT,
        is_favorite INTEGER NOT NULL DEFAULT 0,
        last_chapter_index INTEGER NOT NULL DEFAULT 0,
        last_page_index INTEGER NOT NULL DEFAULT 0,
        total_pages INTEGER NOT NULL DEFAULT 0
      )`
    ).run();

    db.prepare(
      `CREATE TABLE IF NOT EXISTS manga_tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        name_key TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
      )`
    ).run();

    db.prepare(
      `CREATE TABLE IF NOT EXISTS manga_book_tags (
        manga_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (manga_id, tag_id),
        FOREIGN KEY (manga_id) REFERENCES manga_books(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES manga_tags(id) ON DELETE CASCADE
      )`
    ).run();

    db.prepare(
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
      )`
    ).run();

    db.prepare(
      `CREATE TABLE IF NOT EXISTS directory_aliases (
        id TEXT PRIMARY KEY,
        alias TEXT NOT NULL,
        alias_key TEXT NOT NULL UNIQUE,
        canonical_name TEXT NOT NULL,
        canonical_key TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`
    ).run();

    db.prepare(
      `CREATE TABLE IF NOT EXISTS organizer_directory_usage (
        directory_relative_path TEXT PRIMARY KEY,
        last_moved_at TEXT NOT NULL,
        move_count INTEGER NOT NULL DEFAULT 0
      )`
    ).run();

    db.prepare(
      `CREATE TABLE IF NOT EXISTS source_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`
    ).run();

    db.prepare('CREATE INDEX IF NOT EXISTS idx_source_books_added_at ON manga_books(added_at)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_source_books_last_read_at ON manga_books(last_read_at)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_source_bookmarks_manga_id ON bookmarks(manga_id)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_source_aliases_canonical_key ON directory_aliases(canonical_key)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_source_usage_last_moved_at ON organizer_directory_usage(last_moved_at)').run();

    db.pragma(`user_version = ${SOURCE_SCHEMA_VERSION}`);
  });

  migration();
}

function readSourceMetadataValue(db: Database.Database, key: string): string | null {
  const row = db.prepare('SELECT key, value FROM source_metadata WHERE key = ? LIMIT 1').get(key) as SourceMetadataValueRow | undefined;
  return row?.value ?? null;
}

function writeSourceMetadataValue(db: Database.Database, key: string, value: string): void {
  db.prepare(
    `INSERT INTO source_metadata (key, value, updated_at)
      VALUES (@key, @value, @updated_at)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run({
    key,
    value,
    updated_at: new Date().toISOString()
  });
}

function sortMangas(items: MangaBook[], sortBy: MangaFilter['sortBy']): MangaBook[] {
  return [...items].sort((first, second) => {
    if (sortBy === 'lastReadAtDesc') {
      return new Date(second.lastReadAt ?? second.addedAt).getTime() - new Date(first.lastReadAt ?? first.addedAt).getTime();
    }
    if (sortBy === 'addedAtAsc') {
      return new Date(first.addedAt).getTime() - new Date(second.addedAt).getTime();
    }
    if (sortBy === 'titleAsc') {
      return first.title.localeCompare(second.title, 'zh-Hans-CN');
    }
    if (sortBy === 'titleDesc') {
      return second.title.localeCompare(first.title, 'zh-Hans-CN');
    }

    return new Date(second.addedAt).getTime() - new Date(first.addedAt).getTime();
  });
}

function readAuthorAliasMetadata(directoryPath: string): SourceAuthorAliasMetadata | null {
  const metadataPath = path.join(normalizeAbsolutePath(directoryPath), AUTHOR_ALIAS_METADATA_FILENAME);
  if (!fs.existsSync(metadataPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(metadataPath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<SourceAuthorAliasMetadata>;
    const aliases = Array.isArray(parsed.aliases)
      ? parsed.aliases.map((item) => String(item).trim()).filter((item) => item.length > 0)
      : [];
    const canonicalName = String(parsed.canonicalName ?? '').trim() || path.basename(directoryPath);
    return {
      canonicalName,
      aliases: Array.from(new Set(aliases)),
      updatedAt: String(parsed.updatedAt ?? '') || new Date().toISOString()
    };
  } catch {
    return null;
  }
}

export class SourceMetadataManager {
  private cache = new Map<string, SourceDbHandle>();

  constructor(
    private readonly registry: LibraryRegistry,
    private readonly legacyDb: Database.Database
  ) {}

  openSourceMetadataDb(sourceRoot: string): Database.Database {
    return this.ensureSourceMetadataDb(sourceRoot).db;
  }

  ensureSourceMetadataDb(sourceRoot: string): SourceDbHandle {
    const normalizedRootPath = normalizeAbsolutePath(sourceRoot);
    const cached = this.cache.get(normalizedRootPath);
    if (cached) {
      return cached;
    }

    ensureSourceMetadataDirectory(normalizedRootPath);
    const dbPath = getSourceMetadataDbPath(normalizedRootPath);
    const db = new Database(dbPath);
    initializeSourceSchema(db);

    const handle: SourceDbHandle = {
      rootPath: normalizedRootPath,
      dbPath,
      db
    };

    this.cache.set(normalizedRootPath, handle);
    this.migrateLegacySourceData(normalizedRootPath);
    return handle;
  }

  migrateLegacySourceData(sourceRoot: string): void {
    const handle = this.ensureSourceMetadataDb(sourceRoot);
    const { db, rootPath } = handle;

    if (readSourceMetadataValue(db, METADATA_KEYS.legacyMigrationComplete) !== '1') {
      const transaction = db.transaction(() => {
        this.migrateLegacyMangas(rootPath);
        this.migrateLegacyAliases(rootPath);
        this.migrateLegacyDirectoryUsage(rootPath);
        writeSourceMetadataValue(db, METADATA_KEYS.legacyMigrationComplete, '1');
      });
      transaction();
    }

    if (readSourceMetadataValue(db, METADATA_KEYS.authorFileImportComplete) !== '1') {
      const transaction = db.transaction(() => {
        this.migrateAuthorAliasFiles(rootPath);
        writeSourceMetadataValue(db, METADATA_KEYS.authorFileImportComplete, '1');
      });
      transaction();
    }
  }

  private migrateLegacyMangas(sourceRoot: string): void {
    const handle = this.ensureSourceMetadataDb(sourceRoot);
    const legacyRows = this.legacyDb
      .prepare(
        `SELECT id, title, folder_path, structure, added_at, last_read_at, is_favorite, last_chapter_index, last_page_index, total_pages
          FROM manga_books
          WHERE source_folder_path = ?`
      )
      .all(sourceRoot) as Array<
      Omit<SourceMangaRow, 'relative_path'> & {
        folder_path: string;
      }
    >;

    for (const row of legacyRows) {
      try {
        const relativePath = toRelativePath(sourceRoot, row.folder_path);
        this.putMangaRecord(handle, {
          id: row.id,
          title: row.title,
          relativePath,
          structure: row.structure,
          addedAt: row.added_at,
          lastReadAt: row.last_read_at,
          isFavorite: row.is_favorite,
          lastChapterIndex: row.last_chapter_index,
          lastPageIndex: row.last_page_index,
          totalPages: row.total_pages
        });

        const legacyTags = this.legacyDb
          .prepare(
            `SELECT t.name, t.created_at
              FROM manga_book_tags mbt
              JOIN manga_tags t ON t.id = mbt.tag_id
              WHERE mbt.manga_id = ?
              ORDER BY t.name COLLATE NOCASE ASC`
          )
          .all(row.id) as Array<{ name: string; created_at: string }>;

        for (const legacyTag of legacyTags) {
          const tag = this.upsertSourceTag(handle, legacyTag.name, legacyTag.created_at);
          this.linkTagToManga(handle, row.id, tag.id);
        }

        const legacyBookmarks = this.legacyDb
          .prepare(
            `SELECT id, manga_id, chapter_index, page_index, chapter_name, title, note, created_at
              FROM bookmarks
              WHERE manga_id = ?`
          )
          .all(row.id) as SourceBookmarkRow[];

        for (const bookmark of legacyBookmarks) {
          handle.db
            .prepare(
              `INSERT OR IGNORE INTO bookmarks (
                id, manga_id, chapter_index, page_index, chapter_name, title, note, created_at
              ) VALUES (
                @id, @manga_id, @chapter_index, @page_index, @chapter_name, @title, @note, @created_at
              )`
            )
            .run(bookmark);
        }
      } catch {
        continue;
      }
    }
  }

  private migrateLegacyAliases(sourceRoot: string): void {
    const artistsRootPath = findArtistsDirectoryPathSync(sourceRoot);
    if (!artistsRootPath) {
      return;
    }

    const handle = this.ensureSourceMetadataDb(sourceRoot);
    const directChildDirectories = new Map(
      listChildDirectories(artistsRootPath).map((directoryPath) => [toKey(path.basename(directoryPath)), path.basename(directoryPath)])
    );
    if (directChildDirectories.size === 0) {
      return;
    }

    const aliases = this.legacyDb.prepare('SELECT * FROM directory_aliases ORDER BY alias ASC').all() as SourceAliasRow[];
    for (const alias of aliases) {
      const directoryName = directChildDirectories.get(alias.canonical_key);
      if (!directoryName) {
        continue;
      }

      this.upsertAlias(handle, alias.alias, directoryName, alias.created_at, alias.id);
    }
  }

  private migrateAuthorAliasFiles(sourceRoot: string): void {
    const handle = this.ensureSourceMetadataDb(sourceRoot);
    const artistsRootPath = findArtistsDirectoryPathSync(sourceRoot);
    if (!artistsRootPath) {
      return;
    }

    for (const directoryPath of listChildDirectories(artistsRootPath)) {
      const metadata = readAuthorAliasMetadata(directoryPath);
      if (!metadata) {
        continue;
      }

      for (const aliasName of metadata.aliases) {
        this.upsertAlias(handle, aliasName, metadata.canonicalName, metadata.updatedAt);
      }
    }
  }

  private migrateLegacyDirectoryUsage(sourceRoot: string): void {
    const handle = this.ensureSourceMetadataDb(sourceRoot);
    const rows = this.legacyDb
      .prepare(
        `SELECT directory_path, last_moved_at, move_count
          FROM organizer_directory_usage
          WHERE directory_path = ? OR directory_path LIKE ?`
      )
      .all(sourceRoot, `${sourceRoot}${path.sep}%`) as Array<{
      directory_path: string;
      last_moved_at: string;
      move_count: number;
    }>;

    for (const row of rows) {
      try {
        const relativeDirectoryPath = toRelativePath(sourceRoot, row.directory_path);
        handle.db
          .prepare(
            `INSERT INTO organizer_directory_usage (directory_relative_path, last_moved_at, move_count)
              VALUES (@directory_relative_path, @last_moved_at, @move_count)
              ON CONFLICT(directory_relative_path) DO UPDATE SET
                last_moved_at = excluded.last_moved_at,
                move_count = MAX(organizer_directory_usage.move_count, excluded.move_count)`
          )
          .run({
            directory_relative_path: relativeDirectoryPath,
            last_moved_at: row.last_moved_at,
            move_count: row.move_count
          });
      } catch {
        continue;
      }
    }
  }

  private putMangaRecord(
    handle: SourceDbHandle,
    record: {
      id: string;
      title: string;
      relativePath: string;
      structure: MangaStructure;
      addedAt: string;
      lastReadAt: string | null;
      isFavorite: 0 | 1;
      lastChapterIndex: number;
      lastPageIndex: number;
      totalPages: number;
    }
  ): void {
    handle.db
      .prepare(
        `INSERT INTO manga_books (
          id, title, relative_path, structure, added_at,
          last_read_at, is_favorite, last_chapter_index, last_page_index, total_pages
        ) VALUES (
          @id, @title, @relative_path, @structure, @added_at,
          @last_read_at, @is_favorite, @last_chapter_index, @last_page_index, @total_pages
        )
        ON CONFLICT(relative_path) DO UPDATE SET
          title = excluded.title,
          structure = excluded.structure,
          total_pages = excluded.total_pages,
          last_read_at = COALESCE(excluded.last_read_at, manga_books.last_read_at),
          is_favorite = excluded.is_favorite,
          last_chapter_index = excluded.last_chapter_index,
          last_page_index = excluded.last_page_index`
      )
      .run({
        id: record.id,
        title: record.title,
        relative_path: record.relativePath,
        structure: record.structure,
        added_at: record.addedAt,
        last_read_at: record.lastReadAt,
        is_favorite: record.isFavorite,
        last_chapter_index: record.lastChapterIndex,
        last_page_index: record.lastPageIndex,
        total_pages: record.totalPages
      });
  }

  private upsertSourceTag(handle: SourceDbHandle, tagName: string, createdAt?: string): MangaTag {
    const normalizedName = tagName.trim();
    const nameKey = toKey(normalizedName);
    const tagId = getDeterministicTagId(normalizedName);
    const now = createdAt ?? new Date().toISOString();

    handle.db
      .prepare(
        `INSERT INTO manga_tags (id, name, name_key, created_at)
          VALUES (@id, @name, @name_key, @created_at)
          ON CONFLICT(name_key) DO UPDATE SET name = excluded.name`
      )
      .run({
        id: tagId,
        name: normalizedName,
        name_key: nameKey,
        created_at: now
      });

    return {
      id: tagId,
      name: normalizedName,
      createdAt: now
    };
  }

  private linkTagToManga(handle: SourceDbHandle, mangaId: string, tagId: string): void {
    handle.db
      .prepare(
        `INSERT OR IGNORE INTO manga_book_tags (manga_id, tag_id, created_at)
          VALUES (@manga_id, @tag_id, @created_at)`
      )
      .run({
        manga_id: mangaId,
        tag_id: tagId,
        created_at: new Date().toISOString()
      });
  }

  private upsertAlias(handle: SourceDbHandle, aliasName: string, canonicalName: string, createdAt?: string, id?: string): DirectoryAlias {
    const alias = aliasName.trim();
    const canonical = canonicalName.trim();
    const now = createdAt ?? new Date().toISOString();
    const aliasKey = toKey(alias);

    handle.db
      .prepare(
        `INSERT INTO directory_aliases (id, alias, alias_key, canonical_name, canonical_key, created_at)
          VALUES (@id, @alias, @alias_key, @canonical_name, @canonical_key, @created_at)
          ON CONFLICT(alias_key) DO UPDATE SET
            alias = excluded.alias,
            canonical_name = excluded.canonical_name,
            canonical_key = excluded.canonical_key`
      )
      .run({
        id: id ?? randomUUID(),
        alias,
        alias_key: aliasKey,
        canonical_name: canonical,
        canonical_key: toKey(canonical),
        created_at: now
      });

    const row = handle.db.prepare('SELECT * FROM directory_aliases WHERE alias_key = ?').get(aliasKey) as SourceAliasRow | undefined;
    if (!row) {
      throw new Error('Failed to store alias');
    }

    return mapAliasRow(row);
  }

  private getHandleBySourceRoot(sourceRoot: string): SourceDbHandle | null {
    const normalizedRootPath = normalizeAbsolutePath(sourceRoot);
    if (!fs.existsSync(normalizedRootPath) || !fs.statSync(normalizedRootPath).isDirectory()) {
      return null;
    }
    return this.ensureSourceMetadataDb(normalizedRootPath);
  }

  private listRegisteredSourceRoots(): string[] {
    return this.registry.list().map((item) => normalizeAbsolutePath(item.path));
  }

  private listRegisteredHandles(): SourceDbHandle[] {
    return this.listRegisteredSourceRoots()
      .map((sourceRoot) => this.getHandleBySourceRoot(sourceRoot))
      .filter((item): item is SourceDbHandle => item !== null);
  }

  resolveSourceRootForPath(targetPath: string, fallback?: string): string | null {
    const normalizedTargetPath = normalizeAbsolutePath(targetPath);
    const candidates = this.listRegisteredSourceRoots().sort((first, second) => second.length - first.length);

    for (const candidate of candidates) {
      if (normalizedTargetPath === candidate || normalizedTargetPath.startsWith(`${candidate}${path.sep}`)) {
        return candidate;
      }
    }

    return fallback ? normalizeAbsolutePath(fallback) : null;
  }

  private findMangaLocationById(mangaId: string): { handle: SourceDbHandle; row: SourceMangaRow } | null {
    for (const handle of this.listRegisteredHandles()) {
      const row = handle.db.prepare('SELECT * FROM manga_books WHERE id = ? LIMIT 1').get(mangaId) as SourceMangaRow | undefined;
      if (row) {
        return { handle, row };
      }
    }
    return null;
  }

  private findBookmarkHandleById(bookmarkId: string): SourceDbHandle | null {
    for (const handle of this.listRegisteredHandles()) {
      const row = handle.db.prepare('SELECT id FROM bookmarks WHERE id = ? LIMIT 1').get(bookmarkId) as { id: string } | undefined;
      if (row) {
        return handle;
      }
    }
    return null;
  }

  getMangaRepository() {
    const manager = this;

    return {
      insert(input: {
        title: string;
        folderPath: string;
        sourceFolderPath: string;
        structure: MangaStructure;
        totalPages: number;
      }): MangaBook {
        return this.upsert(input);
      },

      upsert(input: {
        title: string;
        folderPath: string;
        sourceFolderPath: string;
        structure: MangaStructure;
        totalPages: number;
      }): MangaBook {
        const sourceRoot = normalizeAbsolutePath(input.sourceFolderPath);
        const handle = manager.ensureSourceMetadataDb(sourceRoot);
        const relativePath = toRelativePath(sourceRoot, input.folderPath);
        const existing = handle.db.prepare('SELECT * FROM manga_books WHERE relative_path = ?').get(relativePath) as SourceMangaRow | undefined;
        const now = new Date().toISOString();

        manager.putMangaRecord(handle, {
          id: existing?.id ?? randomUUID(),
          title: input.title,
          relativePath,
          structure: input.structure,
          addedAt: existing?.added_at ?? now,
          lastReadAt: existing?.last_read_at ?? null,
          isFavorite: existing?.is_favorite ?? 0,
          lastChapterIndex: existing?.last_chapter_index ?? 0,
          lastPageIndex: existing?.last_page_index ?? 0,
          totalPages: input.totalPages
        });

        const row = handle.db.prepare('SELECT * FROM manga_books WHERE relative_path = ? LIMIT 1').get(relativePath) as SourceMangaRow | undefined;
        if (!row) {
          throw new Error('Failed to upsert manga');
        }

        return mapMangaRow(row, sourceRoot);
      },

      getById(id: string): MangaBook | null {
        const located = manager.findMangaLocationById(id);
        return located ? mapMangaRow(located.row, located.handle.rootPath) : null;
      },

      updatePath(id: string, title: string, folderPath: string, sourceFolderPath: string): MangaBook {
        const located = manager.findMangaLocationById(id);
        if (!located) {
          throw new Error('Manga not found');
        }

        const destinationSourceRoot = normalizeAbsolutePath(sourceFolderPath);
        const destinationHandle = manager.ensureSourceMetadataDb(destinationSourceRoot);
        const nextRelativePath = toRelativePath(destinationSourceRoot, folderPath);

        if (located.handle.rootPath === destinationSourceRoot) {
          located.handle.db
            .prepare('UPDATE manga_books SET title = @title, relative_path = @relative_path WHERE id = @id')
            .run({
              id,
              title,
              relative_path: nextRelativePath
            });
        } else {
          const sourceTags = located.handle.db
            .prepare(
              `SELECT t.name, t.created_at
                FROM manga_book_tags mbt
                JOIN manga_tags t ON t.id = mbt.tag_id
                WHERE mbt.manga_id = ?
                ORDER BY t.name COLLATE NOCASE ASC`
            )
            .all(id) as Array<{ name: string; created_at: string }>;

          const sourceBookmarks = located.handle.db
            .prepare('SELECT * FROM bookmarks WHERE manga_id = ? ORDER BY created_at ASC')
            .all(id) as SourceBookmarkRow[];

          manager.putMangaRecord(destinationHandle, {
            id: located.row.id,
            title,
            relativePath: nextRelativePath,
            structure: located.row.structure,
            addedAt: located.row.added_at,
            lastReadAt: located.row.last_read_at,
            isFavorite: located.row.is_favorite,
            lastChapterIndex: located.row.last_chapter_index,
            lastPageIndex: located.row.last_page_index,
            totalPages: located.row.total_pages
          });

          for (const tag of sourceTags) {
            const stored = manager.upsertSourceTag(destinationHandle, tag.name, tag.created_at);
            manager.linkTagToManga(destinationHandle, id, stored.id);
          }

          for (const bookmark of sourceBookmarks) {
            destinationHandle.db
              .prepare(
                `INSERT OR IGNORE INTO bookmarks (
                  id, manga_id, chapter_index, page_index, chapter_name, title, note, created_at
                ) VALUES (
                  @id, @manga_id, @chapter_index, @page_index, @chapter_name, @title, @note, @created_at
                )`
              )
              .run(bookmark);
          }

          located.handle.db.prepare('DELETE FROM manga_books WHERE id = ?').run(id);
        }

        const nextRow = destinationHandle.db.prepare('SELECT * FROM manga_books WHERE id = ? LIMIT 1').get(id) as SourceMangaRow | undefined;
        if (!nextRow) {
          throw new Error('Manga not found after move');
        }

        return mapMangaRow(nextRow, destinationSourceRoot);
      },

      renameDirectoryPrefix(previousDirectoryPath: string, nextDirectoryPath: string): number {
        const previousPath = normalizeAbsolutePath(previousDirectoryPath);
        const nextPath = normalizeAbsolutePath(nextDirectoryPath);
        const sourceRoot = manager.resolveSourceRootForPath(previousPath);
        if (!sourceRoot) {
          return 0;
        }

        const nextSourceRoot = manager.resolveSourceRootForPath(nextPath, sourceRoot);
        if (nextSourceRoot !== sourceRoot) {
          throw new Error('Author directory rename must stay within the same source root');
        }

        const handle = manager.ensureSourceMetadataDb(sourceRoot);
        const previousRelativePath = toRelativePath(sourceRoot, previousPath);
        const nextRelativePath = toRelativePath(sourceRoot, nextPath);
        const previousPrefix = `${previousRelativePath}${path.sep}`;
        const nextPrefix = `${nextRelativePath}${path.sep}`;
        const prefixLength = previousPrefix.length;

        const result = handle.db
          .prepare(
            `UPDATE manga_books
              SET relative_path = CASE
                WHEN relative_path = @previousRelativePath THEN @nextRelativePath
                ELSE @nextPrefix || substr(relative_path, @prefixLength + 1)
              END
              WHERE relative_path = @previousRelativePath
                OR substr(relative_path, 1, @prefixLength) = @previousPrefix`
          )
          .run({
            previousRelativePath,
            nextRelativePath,
            previousPrefix,
            nextPrefix,
            prefixLength
          });

        return result.changes;
      },

      updateProgress(input: {
        mangaId: string;
        chapterIndex: number;
        pageIndex: number;
        totalPages: number;
      }): void {
        const located = manager.findMangaLocationById(input.mangaId);
        if (!located) {
          return;
        }

        located.handle.db
          .prepare(
            `UPDATE manga_books SET
              last_chapter_index = @chapter_index,
              last_page_index = @page_index,
              total_pages = @total_pages,
              last_read_at = @last_read_at
            WHERE id = @id`
          )
          .run({
            id: input.mangaId,
            chapter_index: input.chapterIndex,
            page_index: input.pageIndex,
            total_pages: input.totalPages,
            last_read_at: new Date().toISOString()
          });
      },

      deleteByFolderPath(folderPath: string): void {
        const sourceRoot = manager.resolveSourceRootForPath(folderPath);
        if (!sourceRoot) {
          return;
        }

        const handle = manager.getHandleBySourceRoot(sourceRoot);
        if (!handle) {
          return;
        }

        handle.db.prepare('DELETE FROM manga_books WHERE relative_path = ?').run(toRelativePath(sourceRoot, folderPath));
      },

      deleteBySource(sourceFolderPath: string): void {
        const handle = manager.getHandleBySourceRoot(sourceFolderPath);
        if (!handle) {
          return;
        }

        handle.db.prepare('DELETE FROM manga_books').run();
      },

      deleteById(id: string): boolean {
        const located = manager.findMangaLocationById(id);
        if (!located) {
          return false;
        }

        const result = located.handle.db.prepare('DELETE FROM manga_books WHERE id = ?').run(id);
        return result.changes > 0;
      },

      listBySource(sourceFolderPath: string): MangaBook[] {
        const handle = manager.getHandleBySourceRoot(sourceFolderPath);
        if (!handle) {
          return [];
        }

        const rows = handle.db.prepare('SELECT * FROM manga_books ORDER BY added_at DESC').all() as SourceMangaRow[];
        return rows.map((row) => mapMangaRow(row, handle.rootPath));
      },

      list(filter?: MangaFilter): MangaBook[] {
        const normalizedSourceFilters = filter?.sourceFolderPaths?.map((item) => normalizeAbsolutePath(item)) ?? null;
        const query = filter?.query?.trim().toLocaleLowerCase() ?? '';
        const books = manager
          .listRegisteredHandles()
          .flatMap((handle) => {
            if (normalizedSourceFilters && normalizedSourceFilters.length > 0 && !normalizedSourceFilters.includes(handle.rootPath)) {
              return [];
            }
            const rows = handle.db.prepare('SELECT * FROM manga_books').all() as SourceMangaRow[];
            return rows.map((row) => mapMangaRow(row, handle.rootPath));
          })
          .filter((book) => {
            if (!query) {
              return true;
            }

            return (
              book.title.toLocaleLowerCase().includes(query) ||
              book.folderPath.toLocaleLowerCase().includes(query)
            );
          });

        return sortMangas(books, filter?.sortBy);
      }
    };
  }

  getTagRepository() {
    const manager = this;

    return {
      upsert(name: string): MangaTag {
        const normalizedName = name.trim();
        if (!normalizedName) {
          throw new Error('Tag name is required');
        }

        const handles = manager.listRegisteredHandles();
        if (handles.length === 0) {
          return {
            id: getDeterministicTagId(normalizedName),
            name: normalizedName,
            createdAt: new Date().toISOString()
          };
        }

        let stored: MangaTag | null = null;
        for (const handle of handles) {
          stored = manager.upsertSourceTag(handle, normalizedName, stored?.createdAt);
        }

        return stored as MangaTag;
      },

      list(): MangaTag[] {
        const bucket = new Map<string, MangaTag>();

        for (const handle of manager.listRegisteredHandles()) {
          const rows = handle.db.prepare('SELECT id, name, created_at, name_key FROM manga_tags ORDER BY name COLLATE NOCASE ASC').all() as SourceTagRow[];
          for (const row of rows) {
            const key = row.name_key;
            const existing = bucket.get(key);
            const mapped = mapTagRow(row);
            if (!existing || new Date(mapped.createdAt).getTime() < new Date(existing.createdAt).getTime()) {
              bucket.set(key, mapped);
            }
          }
        }

        return [...bucket.values()].sort((first, second) => first.name.localeCompare(second.name, 'zh-Hans-CN'));
      },

      listByManga(mangaId: string): MangaTag[] {
        const located = manager.findMangaLocationById(mangaId);
        if (!located) {
          return [];
        }

        const rows = located.handle.db
          .prepare(
            `SELECT t.id, t.name, t.name_key, t.created_at
              FROM manga_tags t
              JOIN manga_book_tags mbt ON mbt.tag_id = t.id
              WHERE mbt.manga_id = ?
              ORDER BY t.name COLLATE NOCASE ASC`
          )
          .all(mangaId) as SourceTagRow[];

        return rows.map(mapTagRow);
      },

      listByMangaIds(mangaIds: string[]): Record<string, MangaTag[]> {
        const result: Record<string, MangaTag[]> = {};
        const uniqueIds = Array.from(new Set(mangaIds.filter((item) => item.trim().length > 0)));
        if (uniqueIds.length === 0) {
          return result;
        }

        for (const handle of manager.listRegisteredHandles()) {
          const rows = handle.db
            .prepare(
              `SELECT mbt.manga_id, t.id, t.name, t.name_key, t.created_at
                FROM manga_book_tags mbt
                JOIN manga_tags t ON t.id = mbt.tag_id
                WHERE mbt.manga_id IN (SELECT value FROM json_each(?))
                ORDER BY t.name COLLATE NOCASE ASC`
            )
            .all(JSON.stringify(uniqueIds)) as Array<SourceTagRow & { manga_id: string }>;

          for (const row of rows) {
            if (!result[row.manga_id]) {
              result[row.manga_id] = [];
            }
            result[row.manga_id]?.push(mapTagRow(row));
          }
        }

        return result;
      },

      addToManga(mangaId: string, tagName: string): TagAddToMangaResult {
        const located = manager.findMangaLocationById(mangaId);
        if (!located) {
          throw new Error('Manga not found');
        }

        const tag = manager.upsertSourceTag(located.handle, tagName);
        const result = located.handle.db
          .prepare(
            `INSERT OR IGNORE INTO manga_book_tags (manga_id, tag_id, created_at)
              VALUES (@manga_id, @tag_id, @created_at)`
          )
          .run({
            manga_id: mangaId,
            tag_id: tag.id,
            created_at: new Date().toISOString()
          });

        return {
          tag,
          linked: result.changes > 0
        };
      },

      setForManga(mangaId: string, tagNames: string[]): MangaTag[] {
        const located = manager.findMangaLocationById(mangaId);
        if (!located) {
          throw new Error('Manga not found');
        }

        const uniqueTagNames = Array.from(
          new Map(
            tagNames
              .map((item) => item.trim())
              .filter((item) => item.length > 0)
              .map((item) => [toKey(item), item] as const)
          ).values()
        );

        const save = located.handle.db.transaction(() => {
          located.handle.db.prepare('DELETE FROM manga_book_tags WHERE manga_id = ?').run(mangaId);

          const nextTags: MangaTag[] = [];
          for (const tagName of uniqueTagNames) {
            const stored = manager.upsertSourceTag(located.handle, tagName);
            manager.linkTagToManga(located.handle, mangaId, stored.id);
            nextTags.push(stored);
          }

          return nextTags.sort((first, second) => first.name.localeCompare(second.name, 'zh-Hans-CN'));
        });

        return save();
      },

      removeFromManga(mangaId: string, tagName: string): boolean {
        const located = manager.findMangaLocationById(mangaId);
        if (!located) {
          return false;
        }

        const tagId = getDeterministicTagId(tagName);
        const result = located.handle.db.prepare('DELETE FROM manga_book_tags WHERE manga_id = ? AND tag_id = ?').run(mangaId, tagId);
        return result.changes > 0;
      },

      deleteOrphan(): number {
        let deleted = 0;
        for (const handle of manager.listRegisteredHandles()) {
          const result = handle.db
            .prepare(
              `DELETE FROM manga_tags
                WHERE id IN (
                  SELECT t.id
                  FROM manga_tags t
                  LEFT JOIN manga_book_tags mbt ON mbt.tag_id = t.id
                  GROUP BY t.id
                  HAVING COUNT(mbt.tag_id) = 0
                )`
            )
            .run();
          deleted += result.changes;
        }
        return deleted;
      },

      removeById(id: string): boolean {
        let removed = false;
        for (const handle of manager.listRegisteredHandles()) {
          const result = handle.db.prepare('DELETE FROM manga_tags WHERE id = ?').run(id);
          removed = removed || result.changes > 0;
        }
        return removed;
      },

      clearAll(): number {
        let deleted = 0;
        for (const handle of manager.listRegisteredHandles()) {
          const result = handle.db.prepare('DELETE FROM manga_tags').run();
          deleted += result.changes;
        }
        return deleted;
      }
    };
  }

  getBookmarkRepository() {
    const manager = this;

    return {
      insert(input: {
        mangaId: string;
        chapterIndex: number;
        pageIndex: number;
        title?: string;
        note?: string;
      }): Bookmark {
        const located = manager.findMangaLocationById(input.mangaId);
        if (!located) {
          throw new Error('Manga not found');
        }

        const id = randomUUID();
        const now = new Date().toISOString();
        located.handle.db
          .prepare(
            `INSERT INTO bookmarks (
              id, manga_id, chapter_index, page_index, chapter_name, title, note, created_at
            ) VALUES (
              @id, @manga_id, @chapter_index, @page_index, @chapter_name, @title, @note, @created_at
            )`
          )
          .run({
            id,
            manga_id: input.mangaId,
            chapter_index: input.chapterIndex,
            page_index: input.pageIndex,
            chapter_name: '',
            title: input.title ?? '',
            note: input.note ?? '',
            created_at: now
          });

        const row = located.handle.db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id) as SourceBookmarkRow | undefined;
        if (!row) {
          throw new Error('Failed to create bookmark');
        }

        return mapBookmarkRow(row);
      },

      update(id: string, title: string, note: string): Bookmark {
        const handle = manager.findBookmarkHandleById(id);
        if (!handle) {
          throw new Error('Bookmark not found');
        }

        handle.db.prepare('UPDATE bookmarks SET title = @title, note = @note WHERE id = @id').run({ id, title, note });
        const row = handle.db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id) as SourceBookmarkRow | undefined;
        if (!row) {
          throw new Error('Bookmark not found');
        }

        return mapBookmarkRow(row);
      },

      remove(id: string): boolean {
        const handle = manager.findBookmarkHandleById(id);
        if (!handle) {
          return false;
        }
        const result = handle.db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id);
        return result.changes > 0;
      },

      listByManga(mangaId: string): Bookmark[] {
        const located = manager.findMangaLocationById(mangaId);
        if (!located) {
          return [];
        }

        const rows = located.handle.db
          .prepare('SELECT * FROM bookmarks WHERE manga_id = ? ORDER BY created_at DESC')
          .all(mangaId) as SourceBookmarkRow[];

        return rows.map(mapBookmarkRow);
      }
    };
  }

  getAliasRepository() {
    const manager = this;

    return {
      insert(aliasName: string, canonicalName: string, canonicalPath?: string): DirectoryAlias {
        const sourceRoot = canonicalPath ? manager.resolveSourceRootForPath(canonicalPath) : null;
        if (!sourceRoot) {
          throw new Error('Unable to resolve source for alias');
        }
        return manager.upsertAlias(manager.ensureSourceMetadataDb(sourceRoot), aliasName, canonicalName);
      },

      resolve(name: string): string {
        const key = toKey(name);
        for (const handle of manager.listRegisteredHandles()) {
          const row = handle.db.prepare('SELECT canonical_name FROM directory_aliases WHERE alias_key = ? LIMIT 1').get(key) as
            | { canonical_name: string }
            | undefined;
          if (row?.canonical_name) {
            return row.canonical_name;
          }
        }
        return name;
      },

      list(): DirectoryAlias[] {
        const bucket = new Map<string, DirectoryAlias>();

        for (const handle of manager.listRegisteredHandles()) {
          const rows = handle.db.prepare('SELECT * FROM directory_aliases ORDER BY alias ASC').all() as SourceAliasRow[];
          for (const row of rows) {
            bucket.set(`${handle.rootPath}:${row.alias_key}`, mapAliasRow(row));
          }
        }

        return [...bucket.values()].sort((first, second) => first.alias.localeCompare(second.alias, 'zh-Hans-CN'));
      },

      remove(aliasName: string, canonicalPath?: string): boolean {
        const sourceRoot = canonicalPath ? manager.resolveSourceRootForPath(canonicalPath) : null;
        const aliasKey = toKey(aliasName);

        if (sourceRoot) {
          const handle = manager.ensureSourceMetadataDb(sourceRoot);
          const result = handle.db.prepare('DELETE FROM directory_aliases WHERE alias_key = ?').run(aliasKey);
          return result.changes > 0;
        }

        let removed = false;
        for (const handle of manager.listRegisteredHandles()) {
          const result = handle.db.prepare('DELETE FROM directory_aliases WHERE alias_key = ?').run(aliasKey);
          removed = removed || result.changes > 0;
        }
        return removed;
      },

      updateCanonicalName(previousCanonicalName: string, canonicalName: string, canonicalPath?: string): number {
        const previousKey = toKey(previousCanonicalName);
        const params = {
          canonical_name: canonicalName,
          canonical_key: toKey(canonicalName),
          previous_canonical_key: previousKey
        };

        if (canonicalPath) {
          const sourceRoot = manager.resolveSourceRootForPath(canonicalPath);
          if (!sourceRoot) {
            return 0;
          }

          const handle = manager.ensureSourceMetadataDb(sourceRoot);
          const result = handle.db
            .prepare(
              `UPDATE directory_aliases
                SET canonical_name = @canonical_name, canonical_key = @canonical_key
                WHERE canonical_key = @previous_canonical_key`
            )
            .run(params);
          return result.changes;
        }

        let changed = 0;
        for (const handle of manager.listRegisteredHandles()) {
          const result = handle.db
            .prepare(
              `UPDATE directory_aliases
                SET canonical_name = @canonical_name, canonical_key = @canonical_key
                WHERE canonical_key = @previous_canonical_key`
            )
            .run(params);
          changed += result.changes;
        }
        return changed;
      }
    };
  }

  getDirectoryUsageRepository() {
    const manager = this;

    return {
      touch(directoryPath: string): { directoryPath: string; lastMovedAt: string; moveCount: number } {
        const sourceRoot = manager.resolveSourceRootForPath(directoryPath);
        if (!sourceRoot) {
          throw new Error('Unable to resolve source for directory usage');
        }

        const handle = manager.ensureSourceMetadataDb(sourceRoot);
        const relativePath = toRelativePath(sourceRoot, directoryPath);
        const now = new Date().toISOString();

        handle.db
          .prepare(
            `INSERT INTO organizer_directory_usage (directory_relative_path, last_moved_at, move_count)
              VALUES (@directory_relative_path, @last_moved_at, 1)
              ON CONFLICT(directory_relative_path) DO UPDATE SET
                last_moved_at = excluded.last_moved_at,
                move_count = organizer_directory_usage.move_count + 1`
          )
          .run({
            directory_relative_path: relativePath,
            last_moved_at: now
          });

        const row = handle.db
          .prepare(
            'SELECT directory_relative_path, last_moved_at, move_count FROM organizer_directory_usage WHERE directory_relative_path = ? LIMIT 1'
          )
          .get(relativePath) as SourceDirectoryUsageRow | undefined;

        if (!row) {
          throw new Error('Failed to update directory usage');
        }

        return {
          directoryPath: toAbsolutePath(handle.rootPath, row.directory_relative_path),
          lastMovedAt: row.last_moved_at,
          moveCount: row.move_count
        };
      },

      listByPaths(paths: string[]): Array<{ directoryPath: string; lastMovedAt: string; moveCount: number }> {
        const grouped = new Map<string, string[]>();

        for (const rawPath of paths) {
          const sourceRoot = manager.resolveSourceRootForPath(rawPath);
          if (!sourceRoot) {
            continue;
          }

          const relativePath = toRelativePath(sourceRoot, rawPath);
          const current = grouped.get(sourceRoot) ?? [];
          current.push(relativePath);
          grouped.set(sourceRoot, current);
        }

        const result: Array<{ directoryPath: string; lastMovedAt: string; moveCount: number }> = [];
        for (const [sourceRoot, relativePaths] of grouped) {
          const handle = manager.ensureSourceMetadataDb(sourceRoot);
          const rows = handle.db
            .prepare(
              `SELECT directory_relative_path, last_moved_at, move_count
                FROM organizer_directory_usage
                WHERE directory_relative_path IN (SELECT value FROM json_each(?))`
            )
            .all(JSON.stringify(relativePaths)) as SourceDirectoryUsageRow[];

          for (const row of rows) {
            result.push({
              directoryPath: toAbsolutePath(sourceRoot, row.directory_relative_path),
              lastMovedAt: row.last_moved_at,
              moveCount: row.move_count
            });
          }
        }

        return result;
      }
    };
  }
}

export function createSourceMetadataRepositories(registry: LibraryRegistry, legacyDb: Database.Database) {
  const manager = new SourceMetadataManager(registry, legacyDb);

  return {
    sourceMetadata: manager,
    manga: manager.getMangaRepository(),
    tag: manager.getTagRepository(),
    bookmark: manager.getBookmarkRepository(),
    alias: manager.getAliasRepository(),
    directoryUsage: manager.getDirectoryUsageRepository()
  };
}

export { SOURCE_METADATA_DB_FILENAME, SOURCE_METADATA_DIRNAME, getSourceMetadataDbPath, isMetadataDirectoryPath };
