import Foundation
import GRDB

enum Schema {
    static let legacyVersion = 3
    static let sourceVersion = 1

    static let legacyStatements: [String] = [
        """
        CREATE TABLE IF NOT EXISTS manga_books (
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
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS library_folders (
          id TEXT PRIMARY KEY,
          path TEXT NOT NULL UNIQUE,
          display_name TEXT NOT NULL,
          added_at TEXT NOT NULL,
          is_target INTEGER NOT NULL DEFAULT 0
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS manga_tags (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          name_key TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS manga_book_tags (
          manga_id TEXT NOT NULL,
          tag_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          PRIMARY KEY (manga_id, tag_id),
          FOREIGN KEY (manga_id) REFERENCES manga_books(id) ON DELETE CASCADE,
          FOREIGN KEY (tag_id) REFERENCES manga_tags(id) ON DELETE CASCADE
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS bookmarks (
          id TEXT PRIMARY KEY,
          manga_id TEXT NOT NULL,
          chapter_index INTEGER NOT NULL,
          page_index INTEGER NOT NULL,
          chapter_name TEXT NOT NULL DEFAULT '',
          title TEXT NOT NULL DEFAULT '',
          note TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          FOREIGN KEY (manga_id) REFERENCES manga_books(id) ON DELETE CASCADE
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS directory_aliases (
          id TEXT PRIMARY KEY,
          alias TEXT NOT NULL,
          alias_key TEXT NOT NULL UNIQUE,
          canonical_name TEXT NOT NULL,
          canonical_key TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS organizer_directory_usage (
          directory_path TEXT PRIMARY KEY,
          last_moved_at TEXT NOT NULL,
          move_count INTEGER NOT NULL DEFAULT 0
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_books_source ON manga_books(source_folder_path)",
        "CREATE INDEX IF NOT EXISTS idx_books_title ON manga_books(title)",
        "CREATE INDEX IF NOT EXISTS idx_books_last_read ON manga_books(last_read_at)",
        "CREATE INDEX IF NOT EXISTS idx_bookmarks_manga ON bookmarks(manga_id)",
        "CREATE INDEX IF NOT EXISTS idx_aliases_canonical_key ON directory_aliases(canonical_key)",
        "CREATE INDEX IF NOT EXISTS idx_directory_usage_last_moved ON organizer_directory_usage(last_moved_at)"
    ]

    static let sourceStatements: [String] = [
        """
        CREATE TABLE IF NOT EXISTS manga_books (
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
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS manga_tags (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          name_key TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS manga_book_tags (
          manga_id TEXT NOT NULL,
          tag_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          PRIMARY KEY (manga_id, tag_id),
          FOREIGN KEY (manga_id) REFERENCES manga_books(id) ON DELETE CASCADE,
          FOREIGN KEY (tag_id) REFERENCES manga_tags(id) ON DELETE CASCADE
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS bookmarks (
          id TEXT PRIMARY KEY,
          manga_id TEXT NOT NULL,
          chapter_index INTEGER NOT NULL,
          page_index INTEGER NOT NULL,
          chapter_name TEXT NOT NULL DEFAULT '',
          title TEXT NOT NULL DEFAULT '',
          note TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          FOREIGN KEY (manga_id) REFERENCES manga_books(id) ON DELETE CASCADE
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS directory_aliases (
          id TEXT PRIMARY KEY,
          alias TEXT NOT NULL,
          alias_key TEXT NOT NULL UNIQUE,
          canonical_name TEXT NOT NULL,
          canonical_key TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS organizer_directory_usage (
          directory_relative_path TEXT PRIMARY KEY,
          last_moved_at TEXT NOT NULL,
          move_count INTEGER NOT NULL DEFAULT 0
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS source_metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_source_books_added_at ON manga_books(added_at)",
        "CREATE INDEX IF NOT EXISTS idx_source_books_last_read_at ON manga_books(last_read_at)",
        "CREATE INDEX IF NOT EXISTS idx_source_bookmarks_manga_id ON bookmarks(manga_id)",
        "CREATE INDEX IF NOT EXISTS idx_source_aliases_canonical_key ON directory_aliases(canonical_key)",
        "CREATE INDEX IF NOT EXISTS idx_source_usage_last_moved_at ON organizer_directory_usage(last_moved_at)"
    ]

    static func initializeLegacy(_ db: Database) throws {
        let version = try Int.fetchOne(db, sql: "PRAGMA user_version") ?? 0
        if version >= legacyVersion { return }
        for statement in legacyStatements {
            try db.execute(sql: statement)
        }
        let columns = try Row.fetchAll(db, sql: "PRAGMA table_info(library_folders)")
        let hasIsTarget = columns.contains { (row: Row) in (row["name"] as String) == "is_target" }
        if !hasIsTarget {
            try db.execute(sql: "ALTER TABLE library_folders ADD COLUMN is_target INTEGER NOT NULL DEFAULT 0")
        }
        try db.execute(sql: "PRAGMA user_version = \(legacyVersion)")
    }

    static func initializeSource(_ db: Database) throws {
        let version = try Int.fetchOne(db, sql: "PRAGMA user_version") ?? 0
        if version >= sourceVersion { return }
        for statement in sourceStatements {
            try db.execute(sql: statement)
        }
        try db.execute(sql: "PRAGMA user_version = \(sourceVersion)")
    }
}

enum SQLValue {
    static func now() -> String {
        ISO8601DateFormatter.threadSafe.string(from: Date())
    }
}

extension ISO8601DateFormatter {
    static let threadSafe: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}

public enum Parse {
    public static func date(_ value: String?) -> Date? {
        guard let value else { return nil }
        return ISO8601DateFormatter.threadSafe.date(from: value)
            ?? ISO8601DateFormatter().date(from: value)
    }
}
