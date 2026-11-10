import Foundation
import GRDB

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
