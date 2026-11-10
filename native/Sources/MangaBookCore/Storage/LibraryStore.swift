import Foundation
import GRDB

public final class LibraryStore: @unchecked Sendable {
    private let dbQueue: DatabaseQueue

    public init(databaseURL: URL = AppPaths.legacyDatabaseURL) throws {
        try FileManager.default.createDirectory(
            at: databaseURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        var configuration = Configuration()
        configuration.foreignKeysEnabled = true
        dbQueue = try DatabaseQueue(path: databaseURL.path, configuration: configuration)
        try dbQueue.write { db in
            try Schema.initializeLegacy(db)
        }
    }

    public func list() throws -> [LibraryFolder] {
        try dbQueue.read { db in
            try Row.fetchAll(db, sql: "SELECT * FROM library_folders ORDER BY added_at ASC").map(mapFolder)
        }
    }

    public func root() throws -> LibraryRoot? {
        try dbQueue.read { db in
            let row = try Row.fetchOne(
                db,
                sql: "SELECT * FROM library_folders ORDER BY is_target DESC, added_at ASC LIMIT 1"
            )
            guard let row else { return nil }
            return LibraryRoot(
                path: row["path"],
                displayName: row["display_name"],
                initializedAt: row["added_at"],
                hasCustomIcon: (row["is_target"] as Int) == 1
            )
        }
    }

    public func setRoot(path: String, displayName: String, hasCustomIcon: Bool = true) throws -> LibraryRoot {
        let now = SQLValue.now()
        return try dbQueue.write { db in
            try db.execute(sql: "DELETE FROM library_folders")
            try db.execute(
                sql: """
                INSERT INTO library_folders (id, path, display_name, added_at, is_target)
                VALUES (?, ?, ?, ?, ?)
                """,
                arguments: [UUID().uuidString, path, displayName, now, hasCustomIcon ? 1 : 0]
            )
            return LibraryRoot(
                path: path,
                displayName: displayName,
                initializedAt: now,
                hasCustomIcon: hasCustomIcon
            )
        }
    }

    private func mapFolder(_ row: Row) -> LibraryFolder {
        LibraryFolder(
            id: row["id"],
            path: row["path"],
            displayName: row["display_name"],
            addedAt: row["added_at"],
            isTarget: (row["is_target"] as Int) == 1
        )
    }
}
