import Foundation
import GRDB

public final class AliasRepository: @unchecked Sendable {
    private let store: SourceMetadataStore

    public init(store: SourceMetadataStore) {
        self.store = store
    }

    public func list() throws -> [DirectoryAlias] {
        var bucket: [String: DirectoryAlias] = [:]
        for (_, queue) in store.listRegisteredDatabases() {
            let rows = try queue.read { db in
                try Row.fetchAll(db, sql: "SELECT * FROM directory_aliases ORDER BY alias COLLATE NOCASE ASC")
            }
            for row in rows {
                bucket[PathUtils.key(row["alias"])] = mapAlias(row)
            }
        }
        return bucket.values.sorted {
            $0.alias.compare($1.alias, options: [.caseInsensitive], range: nil, locale: Locale(identifier: "zh-Hans-CN")) == .orderedAscending
        }
    }

    @discardableResult
    public func upsert(alias: String, canonicalName: String) throws -> DirectoryAlias {
        let trimmedAlias = alias.trimmingCharacters(in: .whitespacesAndNewlines)
        let canonical = canonicalName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedAlias.isEmpty, !canonical.isEmpty else { throw MangaBookError.recordNotFound }
        let handles = store.listRegisteredDatabases()
        guard let first = handles.first else { throw MangaBookError.recordNotFound }
        let aliasKey = PathUtils.key(trimmedAlias)
        let id = UUID().uuidString
        let now = SQLValue.now()
        try first.queue.write { db in
            try db.execute(
                sql: """
                INSERT INTO directory_aliases (id, alias, alias_key, canonical_name, canonical_key, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(alias_key) DO UPDATE SET
                  alias = excluded.alias,
                  canonical_name = excluded.canonical_name,
                  canonical_key = excluded.canonical_key
                """,
                arguments: [id, trimmedAlias, aliasKey, canonical, PathUtils.key(canonical), now]
            )
        }
        return DirectoryAlias(id: id, alias: trimmedAlias, canonicalName: canonical, createdAt: now)
    }

    @discardableResult
    public func updateCanonicalName(previousName: String, nextName: String) throws -> Int {
        let previousKey = PathUtils.key(previousName)
        var changed = 0
        for (_, queue) in store.listRegisteredDatabases() {
            let count = try queue.write { db in
                try db.execute(
                    sql: "UPDATE directory_aliases SET canonical_name = ?, canonical_key = ? WHERE canonical_key = ?",
                    arguments: [nextName, PathUtils.key(nextName), previousKey]
                )
                return db.changesCount
            }
            changed += count
        }
        return changed
    }

    @discardableResult
    public func removeCanonical(_ canonicalName: String) throws -> Int {
        let key = PathUtils.key(canonicalName)
        var changed = 0
        for (_, queue) in store.listRegisteredDatabases() {
            let count = try queue.write { db in
                try db.execute(sql: "DELETE FROM directory_aliases WHERE canonical_key = ?", arguments: [key])
                return db.changesCount
            }
            changed += count
        }
        return changed
    }

    @discardableResult
    public func remove(alias: String) throws -> Bool {
        let key = PathUtils.key(alias)
        var removed = false
        for (_, queue) in store.listRegisteredDatabases() {
            let changes = try queue.write { db in
                try db.execute(sql: "DELETE FROM directory_aliases WHERE alias_key = ?", arguments: [key])
                return db.changesCount
            }
            removed = removed || changes > 0
        }
        return removed
    }

    private func mapAlias(_ row: Row) -> DirectoryAlias {
        DirectoryAlias(id: row["id"], alias: row["alias"], canonicalName: row["canonical_name"], createdAt: row["created_at"])
    }
}
