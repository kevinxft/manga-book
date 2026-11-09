import Foundation
import GRDB

public struct TagAddResult: Sendable {
    public var tag: MangaTag
    public var linked: Bool
}

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
    public func deleteOrphans() throws -> Int {
        var deleted = 0
        for (_, queue) in store.listRegisteredDatabases() {
            let changes = try queue.write { db in
                try db.execute(
                    sql: """
                    DELETE FROM manga_tags
                    WHERE id IN (
                      SELECT t.id FROM manga_tags t
                      LEFT JOIN manga_book_tags mbt ON mbt.tag_id = t.id
                      GROUP BY t.id
                      HAVING COUNT(mbt.tag_id) = 0
                    )
                    """
                )
                return db.changesCount
            }
            deleted += changes
        }
        return deleted
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

public final class BookmarkRepository: @unchecked Sendable {
    private let store: SourceMetadataStore

    public init(store: SourceMetadataStore) {
        self.store = store
    }

    public func listByManga(_ mangaId: String) throws -> [Bookmark] {
        guard let queue = try findQueue(mangaId: mangaId) else { return [] }
        return try queue.read { db in
            try Row.fetchAll(
                db,
                sql: "SELECT * FROM bookmarks WHERE manga_id = ? ORDER BY created_at ASC",
                arguments: [mangaId]
            ).map(mapBookmark)
        }
    }

    @discardableResult
    public func create(mangaId: String, chapterIndex: Int, pageIndex: Int, chapterName: String = "", title: String = "", note: String = "") throws -> Bookmark {
        guard let queue = try findQueue(mangaId: mangaId) else { throw MangaBookError.recordNotFound }
        let id = UUID().uuidString
        let createdAt = SQLValue.now()
        try queue.write { db in
            try db.execute(
                sql: """
                INSERT INTO bookmarks (id, manga_id, chapter_index, page_index, chapter_name, title, note, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                arguments: [id, mangaId, chapterIndex, pageIndex, chapterName, title, note, createdAt]
            )
        }
        return Bookmark(id: id, mangaId: mangaId, chapterIndex: chapterIndex, pageIndex: pageIndex, chapterName: chapterName, title: title, note: note, createdAt: createdAt)
    }

    @discardableResult
    public func update(id: String, title: String, note: String) throws -> Bookmark? {
        guard let queue = try findQueue(bookmarkId: id) else { return nil }
        return try queue.write { db in
            try db.execute(sql: "UPDATE bookmarks SET title = ?, note = ? WHERE id = ?", arguments: [title, note, id])
            let row = try Row.fetchOne(db, sql: "SELECT * FROM bookmarks WHERE id = ? LIMIT 1", arguments: [id])
            return row.map(mapBookmark)
        }
    }

    @discardableResult
    public func delete(id: String) throws -> Bool {
        guard let queue = try findQueue(bookmarkId: id) else { return false }
        return try queue.write { db in
            try db.execute(sql: "DELETE FROM bookmarks WHERE id = ?", arguments: [id])
            return db.changesCount > 0
        }
    }

    private func findQueue(mangaId: String) throws -> DatabaseQueue? {
        for (_, queue) in store.listRegisteredDatabases() {
            let exists = try queue.read { db in
                try Bool.fetchOne(db, sql: "SELECT EXISTS(SELECT 1 FROM manga_books WHERE id = ?)", arguments: [mangaId]) ?? false
            }
            if exists { return queue }
        }
        return nil
    }

    private func findQueue(bookmarkId: String) throws -> DatabaseQueue? {
        for (_, queue) in store.listRegisteredDatabases() {
            let exists = try queue.read { db in
                try Bool.fetchOne(db, sql: "SELECT EXISTS(SELECT 1 FROM bookmarks WHERE id = ?)", arguments: [bookmarkId]) ?? false
            }
            if exists { return queue }
        }
        return nil
    }

    private func mapBookmark(_ row: Row) -> Bookmark {
        Bookmark(
            id: row["id"],
            mangaId: row["manga_id"],
            chapterIndex: row["chapter_index"],
            pageIndex: row["page_index"],
            chapterName: row["chapter_name"],
            title: row["title"],
            note: row["note"],
            createdAt: row["created_at"]
        )
    }
}

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

func databaseQuestionMarks(count: Int) -> String {
    Array(repeating: "?", count: count).joined(separator: ", ")
}
