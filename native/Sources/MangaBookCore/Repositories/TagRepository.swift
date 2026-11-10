import Foundation
import GRDB

public final class TagRepository: @unchecked Sendable {
    private let store: SourceMetadataStore

    public init(store: SourceMetadataStore) {
        self.store = store
    }

    public func list() throws -> [MangaTag] {
        var bucket: [String: MangaTag] = [:]
        for (_, queue) in store.listRegisteredDatabases() {
            let rows = try queue.read { db in
                try Row.fetchAll(db, sql: "SELECT id, name, name_key, created_at FROM manga_tags ORDER BY name COLLATE NOCASE ASC")
            }
            for row in rows {
                let key: String = row["name_key"]
                let mapped = mapTag(row)
                if let existing = bucket[key], (Parse.date(existing.createdAt) ?? .distantFuture) <= (Parse.date(mapped.createdAt) ?? .distantFuture) {
                    continue
                }
                bucket[key] = mapped
            }
        }
        return bucket.values.sorted {
            $0.name.compare($1.name, options: [.caseInsensitive], range: nil, locale: Locale(identifier: "zh-Hans-CN")) == .orderedAscending
        }
    }

    public func listByManga(_ mangaId: String) throws -> [MangaTag] {
        guard let located = try findLocation(mangaId: mangaId) else { return [] }
        return try located.read { db in
            try Row.fetchAll(
                db,
                sql: """
                SELECT t.id, t.name, t.name_key, t.created_at
                FROM manga_tags t
                JOIN manga_book_tags mbt ON mbt.tag_id = t.id
                WHERE mbt.manga_id = ?
                ORDER BY t.name COLLATE NOCASE ASC
                """,
                arguments: [mangaId]
            ).map(mapTag)
        }
    }

    public func listAllLinks() throws -> [String: [MangaTag]] {
        var result: [String: [MangaTag]] = [:]
        for (_, queue) in store.listRegisteredDatabases() {
            let rows = try queue.read { db in
                try Row.fetchAll(
                    db,
                    sql: """
                    SELECT mbt.manga_id, t.id, t.name, t.name_key, t.created_at
                    FROM manga_book_tags mbt
                    JOIN manga_tags t ON t.id = mbt.tag_id
                    ORDER BY t.name COLLATE NOCASE ASC
                    """
                )
            }
            for row in rows {
                let mangaId: String = row["manga_id"]
                result[mangaId, default: []].append(mapTag(row))
            }
        }
        return result
    }

    public func listByMangaIds(_ mangaIds: [String]) throws -> [String: [MangaTag]] {
        let ids = Array(Set(mangaIds.filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }))
        guard !ids.isEmpty else { return [:] }
        var result: [String: [MangaTag]] = [:]
        for (_, queue) in store.listRegisteredDatabases() {
            let rows = try queue.read { db in
                try Row.fetchAll(
                    db,
                    sql: """
                    SELECT mbt.manga_id, t.id, t.name, t.name_key, t.created_at
                    FROM manga_book_tags mbt
                    JOIN manga_tags t ON t.id = mbt.tag_id
                    WHERE mbt.manga_id IN (\(databaseQuestionMarks(count: ids.count)))
                    ORDER BY t.name COLLATE NOCASE ASC
                    """,
                    arguments: StatementArguments(ids)
                )
            }
            for row in rows {
                let mangaId: String = row["manga_id"]
                result[mangaId, default: []].append(mapTag(row))
            }
        }
        return result
    }

    @discardableResult
    public func upsert(_ name: String) throws -> MangaTag {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw MangaBookError.recordNotFound }
        let handles = store.listRegisteredDatabases()
        guard !handles.isEmpty else {
            return MangaTag(id: MangaRepository.deterministicTagId(trimmed), name: trimmed, createdAt: SQLValue.now())
        }
        var stored: MangaTag?
        for (_, queue) in handles {
            stored = try upsertTag(queue: queue, name: trimmed, createdAt: stored?.createdAt)
        }
        guard let stored else { throw MangaBookError.recordNotFound }
        return stored
    }

    public func addToManga(mangaId: String, tagName: String) throws -> TagAddResult {
        guard let located = try findLocation(mangaId: mangaId) else { throw MangaBookError.recordNotFound }
        let tag = try upsertTag(queue: located, name: tagName)
        let linked = try located.write { db -> Bool in
            try db.execute(
                sql: "INSERT OR IGNORE INTO manga_book_tags (manga_id, tag_id, created_at) VALUES (?, ?, ?)",
                arguments: [mangaId, tag.id, SQLValue.now()]
            )
            return db.changesCount > 0
        }
        return TagAddResult(tag: tag, linked: linked)
    }

    @discardableResult
    public func setForManga(mangaId: String, tagNames: [String]) throws -> [MangaTag] {
        guard let located = try findLocation(mangaId: mangaId) else { throw MangaBookError.recordNotFound }
        var seen: [String: String] = [:]
        for raw in tagNames {
            let name = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !name.isEmpty else { continue }
            seen[PathUtils.key(name)] = name
        }
        return try located.write { db in
            try db.execute(sql: "DELETE FROM manga_book_tags WHERE manga_id = ?", arguments: [mangaId])
            var tags: [MangaTag] = []
            for name in seen.values {
                let tag = try upsertTag(db: db, name: name)
                try db.execute(
                    sql: "INSERT OR IGNORE INTO manga_book_tags (manga_id, tag_id, created_at) VALUES (?, ?, ?)",
                    arguments: [mangaId, tag.id, SQLValue.now()]
                )
                tags.append(tag)
            }
            return tags.sorted {
                $0.name.compare($1.name, options: [.caseInsensitive], range: nil, locale: Locale(identifier: "zh-Hans-CN")) == .orderedAscending
            }
        }
    }

    @discardableResult
    public func removeFromManga(mangaId: String, tagName: String) throws -> Bool {
        guard let located = try findLocation(mangaId: mangaId) else { return false }
        let tagId = MangaRepository.deterministicTagId(tagName)
        return try located.write { db in
            try db.execute(sql: "DELETE FROM manga_book_tags WHERE manga_id = ? AND tag_id = ?", arguments: [mangaId, tagId])
            return db.changesCount > 0
        }
    }

    @discardableResult
    public func delete(id: String) throws -> Bool {
        var removed = false
        for (_, queue) in store.listRegisteredDatabases() {
            let changes = try queue.write { db in
                try db.execute(sql: "DELETE FROM manga_tags WHERE id = ?", arguments: [id])
                return db.changesCount
            }
            removed = removed || changes > 0
        }
        return removed
    }

    @discardableResult
    public func clearAll() throws -> Int {
        var deleted = 0
        for (_, queue) in store.listRegisteredDatabases() {
            let changes = try queue.write { db in
                try db.execute(sql: "DELETE FROM manga_tags")
                return db.changesCount
            }
            deleted += changes
        }
        return deleted
    }

    private func upsertTag(queue: DatabaseQueue, name: String, createdAt: String? = nil) throws -> MangaTag {
        try queue.write { db in
            try upsertTag(db: db, name: name, createdAt: createdAt)
        }
    }

    private func upsertTag(db: Database, name: String, createdAt: String? = nil) throws -> MangaTag {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw MangaBookError.recordNotFound }
        let tagId = MangaRepository.deterministicTagId(trimmed)
        let now = createdAt ?? SQLValue.now()
        try db.execute(
            sql: """
            INSERT INTO manga_tags (id, name, name_key, created_at) VALUES (?, ?, ?, ?)
            ON CONFLICT(name_key) DO UPDATE SET name = excluded.name
            """,
            arguments: [tagId, trimmed, PathUtils.key(trimmed), now]
        )
        let row = try Row.fetchOne(db, sql: "SELECT id, name, name_key, created_at FROM manga_tags WHERE name_key = ? LIMIT 1", arguments: [PathUtils.key(trimmed)])
        guard let row else { throw MangaBookError.recordNotFound }
        return mapTag(row)
    }

    private func findLocation(mangaId: String) throws -> DatabaseQueue? {
        for (_, queue) in store.listRegisteredDatabases() {
            let exists = try queue.read { db in
                try Bool.fetchOne(db, sql: "SELECT EXISTS(SELECT 1 FROM manga_books WHERE id = ?)", arguments: [mangaId]) ?? false
            }
            if exists { return queue }
        }
        return nil
    }

    private func mapTag(_ row: Row) -> MangaTag {
        MangaTag(id: row["id"], name: row["name"], createdAt: row["created_at"])
    }
}

private func databaseQuestionMarks(count: Int) -> String {
    Array(repeating: "?", count: count).joined(separator: ", ")
}
