import GRDB

public final class DirectoryUsageRepository: @unchecked Sendable {
    private let store: SourceMetadataStore

    public init(store: SourceMetadataStore) {
        self.store = store
    }

    public func touch(directoryPath: String, sourceRoot: String) throws {
        guard let queue = store.existingDatabase(for: sourceRoot),
              let relative = PathUtils.relativePath(from: sourceRoot, to: directoryPath) else { return }
        try queue.write { db in
            try db.execute(
                sql: """
                INSERT INTO organizer_directory_usage (directory_relative_path, last_moved_at, move_count)
                VALUES (?, ?, 1)
                ON CONFLICT(directory_relative_path) DO UPDATE SET
                  last_moved_at = excluded.last_moved_at,
                  move_count = organizer_directory_usage.move_count + 1
                """,
                arguments: [relative, SQLValue.now()]
            )
        }
    }

    public func lastMovedAt(directoryPath: String, sourceRoot: String) throws -> String? {
        guard let queue = store.existingDatabase(for: sourceRoot),
              let relative = PathUtils.relativePath(from: sourceRoot, to: directoryPath) else { return nil }
        return try queue.read { db in
            try String.fetchOne(
                db,
                sql: "SELECT last_moved_at FROM organizer_directory_usage WHERE directory_relative_path = ?",
                arguments: [relative]
            )
        }
    }
}
