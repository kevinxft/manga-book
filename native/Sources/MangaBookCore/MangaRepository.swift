import Foundation
import GRDB

public struct UpsertMangaInput: Sendable {
    public var title: String
    public var folderPath: String
    public var sourceFolderPath: String
    public var structure: MangaStructure
    public var totalPages: Int

    public init(title: String, folderPath: String, sourceFolderPath: String, structure: MangaStructure, totalPages: Int) {
        self.title = title
        self.folderPath = folderPath
        self.sourceFolderPath = sourceFolderPath
        self.structure = structure
        self.totalPages = totalPages
    }
}

public final class MangaRepository: @unchecked Sendable {
    private let store: SourceMetadataStore

    public init(store: SourceMetadataStore) {
        self.store = store
    }

    public func list(_ filter: MangaFilter = MangaFilter()) throws -> [MangaBook] {
        let normalizedSources = filter.sourceFolderPaths.map(PathUtils.normalize)
        let query = (filter.query ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

        var books: [MangaBook] = []
        for (root, queue) in store.listRegisteredDatabases() {
            if !normalizedSources.isEmpty, !normalizedSources.contains(root) { continue }
            let rows = try queue.read { db in
                try Row.fetchAll(db, sql: "SELECT * FROM manga_books")
            }
            books.append(contentsOf: rows.map { mapManga($0, root: root) })
        }

        if !query.isEmpty {
            books = books.filter {
                $0.title.lowercased().contains(query) || $0.folderPath.lowercased().contains(query)
            }
        }

        return sort(books, by: filter.sort)
    }

    public func listBySource(_ sourceRoot: String) throws -> [MangaBook] {
        let root = PathUtils.normalize(sourceRoot)
        guard let queue = store.existingDatabase(for: root) else { return [] }
        return try queue.read { db in
            try Row.fetchAll(db, sql: "SELECT * FROM manga_books ORDER BY added_at DESC")
                .map { mapManga($0, root: root) }
        }
    }

    public func getById(_ id: String) throws -> MangaBook? {
        guard let located = try findLocation(id: id) else { return nil }
        return mapManga(located.row, root: located.root)
    }

    @discardableResult
    public func upsert(_ input: UpsertMangaInput) throws -> MangaBook {
        let root = PathUtils.normalize(input.sourceFolderPath)
        let queue = try store.database(for: root)
        return try queue.write { db in
            try upsert(db: db, input: input, root: root)
        }
    }

    /// Writes a whole batch in one transaction. Used by the scanner so a full
    /// library sync does not pay one transaction per manga.
    public func upsertMany(_ inputs: [UpsertMangaInput]) throws {
        guard !inputs.isEmpty else { return }
        let grouped = Dictionary(grouping: inputs) { PathUtils.normalize($0.sourceFolderPath) }
        for (root, items) in grouped {
            let queue = try store.database(for: root)
            try queue.write { db in
                for input in items {
                    _ = try upsert(db: db, input: input, root: root)
                }
            }
        }
    }

    private func upsert(db: Database, input: UpsertMangaInput, root: String) throws -> MangaBook {
        guard let relativePath = PathUtils.relativePath(from: root, to: input.folderPath) else {
            throw MangaBookError.pathOutsideRoot(input.folderPath, root)
        }

        let existing = try Row.fetchOne(
            db,
            sql: "SELECT * FROM manga_books WHERE relative_path = ? LIMIT 1",
            arguments: [relativePath]
        )
        let now = SQLValue.now()
        let id: String = existing?["id"] ?? UUID().uuidString
        let addedAt: String = existing?["added_at"] ?? now
        let lastReadAt: String? = existing?["last_read_at"]
        let isFavorite: Int = existing?["is_favorite"] ?? 0
        let lastChapterIndex: Int = existing?["last_chapter_index"] ?? 0
        let lastPageIndex: Int = existing?["last_page_index"] ?? 0

        try db.execute(
            sql: """
            INSERT INTO manga_books (
              id, title, relative_path, structure, added_at,
              last_read_at, is_favorite, last_chapter_index, last_page_index, total_pages
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(relative_path) DO UPDATE SET
              title = excluded.title,
              structure = excluded.structure,
              total_pages = excluded.total_pages
            """,
            arguments: [
                id, input.title, relativePath, input.structure.rawValue, addedAt,
                lastReadAt, isFavorite, lastChapterIndex, lastPageIndex, input.totalPages
            ]
        )

        let row = try Row.fetchOne(
            db,
            sql: "SELECT * FROM manga_books WHERE relative_path = ? LIMIT 1",
            arguments: [relativePath]
        )
        guard let row else { throw MangaBookError.recordNotFound }
        return mapManga(row, root: root)
    }

    public func updateTitle(folderPath: String, title: String) throws {
        guard let root = resolveSourceRoot(for: folderPath),
              let relative = PathUtils.relativePath(from: root, to: folderPath),
              let queue = store.existingDatabase(for: root) else { return }
        try queue.write { db in
            try db.execute(
                sql: "UPDATE manga_books SET title = ? WHERE relative_path = ?",
                arguments: [title, relative]
            )
        }
    }

    public func deleteByFolderPaths(_ paths: [String], sourceRoot: String) throws {
        guard !paths.isEmpty else { return }
        let root = PathUtils.normalize(sourceRoot)
        guard let queue = store.existingDatabase(for: root) else { return }
        let relatives = paths.compactMap { PathUtils.relativePath(from: root, to: $0) }
        guard !relatives.isEmpty else { return }
        try queue.write { db in
            for relative in relatives {
                try db.execute(sql: "DELETE FROM manga_books WHERE relative_path = ?", arguments: [relative])
            }
        }
    }

    @discardableResult
    public func updatePath(id: String, title: String, folderPath: String, sourceFolderPath: String) throws -> MangaBook {
        guard let located = try findLocation(id: id) else { throw MangaBookError.recordNotFound }
        let destinationRoot = PathUtils.normalize(sourceFolderPath)
        guard let nextRelative = PathUtils.relativePath(from: destinationRoot, to: folderPath) else {
            throw MangaBookError.pathOutsideRoot(folderPath, destinationRoot)
        }
        let destination = try store.database(for: destinationRoot)

        if located.root == destinationRoot {
            try located.queue.write { db in
                try db.execute(
                    sql: "UPDATE manga_books SET title = ?, relative_path = ? WHERE id = ?",
                    arguments: [title, nextRelative, id]
                )
            }
        } else {
            let tags = try located.queue.read { db in
                try Row.fetchAll(
                    db,
                    sql: """
                    SELECT t.name, t.created_at FROM manga_book_tags mbt
                    JOIN manga_tags t ON t.id = mbt.tag_id
                    WHERE mbt.manga_id = ? ORDER BY t.name COLLATE NOCASE ASC
                    """,
                    arguments: [id]
                )
            }
            let bookmarks = try located.queue.read { db in
                try Row.fetchAll(db, sql: "SELECT * FROM bookmarks WHERE manga_id = ? ORDER BY created_at ASC", arguments: [id])
            }
            let row = located.row

            try destination.write { db in
                try db.execute(
                    sql: """
                    INSERT OR REPLACE INTO manga_books (
                      id, title, relative_path, structure, added_at,
                      last_read_at, is_favorite, last_chapter_index, last_page_index, total_pages
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    arguments: [
                        id, title, nextRelative, row["structure"] as String, row["added_at"] as String,
                        row["last_read_at"] as String?, row["is_favorite"] as Int, row["last_chapter_index"] as Int,
                        row["last_page_index"] as Int, row["total_pages"] as Int
                    ]
                )
                for tag in tags {
                    let name: String = tag["name"]
                    let createdAt: String = tag["created_at"]
                    let tagId = Self.deterministicTagId(name)
                    try db.execute(
                        sql: """
                        INSERT INTO manga_tags (id, name, name_key, created_at) VALUES (?, ?, ?, ?)
                        ON CONFLICT(name_key) DO UPDATE SET name = excluded.name
                        """,
                        arguments: [tagId, name, PathUtils.key(name), createdAt]
                    )
                    try db.execute(
                        sql: "INSERT OR IGNORE INTO manga_book_tags (manga_id, tag_id, created_at) VALUES (?, ?, ?)",
                        arguments: [id, tagId, SQLValue.now()]
                    )
                }
                for bookmark in bookmarks {
                    try db.execute(
                        sql: """
                        INSERT OR IGNORE INTO bookmarks (
                          id, manga_id, chapter_index, page_index, chapter_name, title, note, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        arguments: [
                            bookmark["id"] as String, bookmark["manga_id"] as String,
                            bookmark["chapter_index"] as Int, bookmark["page_index"] as Int,
                            bookmark["chapter_name"] as String, bookmark["title"] as String,
                            bookmark["note"] as String, bookmark["created_at"] as String
                        ]
                    )
                }
            }
            try located.queue.write { db in
                try db.execute(sql: "DELETE FROM manga_books WHERE id = ?", arguments: [id])
            }
        }

        let next = try destination.read { db in
            try Row.fetchOne(db, sql: "SELECT * FROM manga_books WHERE id = ? LIMIT 1", arguments: [id])
        }
        guard let next else { throw MangaBookError.recordNotFound }
        return mapManga(next, root: destinationRoot)
    }

    @discardableResult
    public func renameDirectoryPrefix(previousDirectoryPath: String, nextDirectoryPath: String) throws -> Int {
        let previous = PathUtils.normalize(previousDirectoryPath)
        let next = PathUtils.normalize(nextDirectoryPath)
        guard let sourceRoot = resolveSourceRoot(for: previous) else { return 0 }
        let nextSourceRoot = resolveSourceRoot(for: next) ?? sourceRoot
        guard nextSourceRoot == sourceRoot else {
            throw MangaBookError.crossRootRename
        }
        guard let previousRelative = PathUtils.relativePath(from: sourceRoot, to: previous),
              let nextRelative = PathUtils.relativePath(from: sourceRoot, to: next) else {
            return 0
        }
        let queue = try store.database(for: sourceRoot)
        return try queue.write { db in
            let rows = try Row.fetchAll(
                db,
                sql: "SELECT id, relative_path FROM manga_books WHERE relative_path = ? OR relative_path LIKE ? ESCAPE '\\'",
                arguments: [previousRelative, Self.likePrefix(previousRelative + "/")]
            )
            var changed = 0
            for row in rows {
                let id: String = row["id"]
                let current: String = row["relative_path"]
                let updated = current == previousRelative
                    ? nextRelative
                    : nextRelative + String(current.dropFirst(previousRelative.count))
                try db.execute(
                    sql: "UPDATE manga_books SET relative_path = ? WHERE id = ?",
                    arguments: [updated, id]
                )
                changed += 1
            }
            return changed
        }
    }

    public func updateProgress(mangaId: String, chapterIndex: Int, pageIndex: Int, totalPages: Int) throws {
        guard let located = try findLocation(id: mangaId) else { return }
        try located.queue.write { db in
            try db.execute(
                sql: """
                UPDATE manga_books SET
                  last_chapter_index = ?, last_page_index = ?, total_pages = ?, last_read_at = ?
                WHERE id = ?
                """,
                arguments: [chapterIndex, pageIndex, totalPages, SQLValue.now(), mangaId]
            )
        }
    }

    public func deleteByFolderPath(_ folderPath: String) throws {
        guard let sourceRoot = resolveSourceRoot(for: folderPath),
              let relative = PathUtils.relativePath(from: sourceRoot, to: folderPath),
              let queue = store.existingDatabase(for: sourceRoot) else { return }
        try queue.write { db in
            try db.execute(sql: "DELETE FROM manga_books WHERE relative_path = ?", arguments: [relative])
        }
    }

    public func deleteBySource(_ sourceRoot: String) throws {
        guard let queue = store.existingDatabase(for: sourceRoot) else { return }
        try queue.write { db in
            try db.execute(sql: "DELETE FROM manga_books")
        }
    }

    @discardableResult
    public func deleteById(_ id: String) throws -> Bool {
        guard let located = try findLocation(id: id) else { return false }
        return try located.queue.write { db in
            try db.execute(sql: "DELETE FROM manga_books WHERE id = ?", arguments: [id])
            return db.changesCount > 0
        }
    }

    public func resolveSourceRoot(for path: String) -> String? {
        let normalized = PathUtils.normalize(path)
        return store.registeredRoots()
            .sorted { $0.count > $1.count }
            .first { PathUtils.isInside(normalized, $0) }
    }

    public static func deterministicTagId(_ name: String) -> String {
        "tag:" + PathUtils.key(name)
    }

    private func findLocation(id: String) throws -> (root: String, queue: DatabaseQueue, row: Row)? {
        for (root, queue) in store.listRegisteredDatabases() {
            let row = try queue.read { db in
                try Row.fetchOne(db, sql: "SELECT * FROM manga_books WHERE id = ? LIMIT 1", arguments: [id])
            }
            if let row { return (root, queue, row) }
        }
        return nil
    }

    private static func likePrefix(_ value: String) -> String {
        let escaped = value
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "%", with: "\\%")
            .replacingOccurrences(of: "_", with: "\\_")
        return escaped + "%"
    }

    private func mapManga(_ row: Row, root: String) -> MangaBook {
        let relative: String = row["relative_path"]
        let structureRaw: String = row["structure"]
        return MangaBook(
            id: row["id"],
            title: row["title"],
            folderPath: PathUtils.join(root, relative),
            sourceFolderPath: root,
            structure: MangaStructure(rawValue: structureRaw) ?? .singleVolume,
            addedAt: row["added_at"],
            lastReadAt: row["last_read_at"],
            isFavorite: (row["is_favorite"] as Int) == 1,
            lastChapterIndex: row["last_chapter_index"],
            lastPageIndex: row["last_page_index"],
            totalPages: row["total_pages"]
        )
    }

    private func sort(_ books: [MangaBook], by sort: MangaSort) -> [MangaBook] {
        let locale = Locale(identifier: "zh-Hans-CN")
        return books.sorted { first, second in
            switch sort {
            case .lastReadAtDesc:
                let firstDate = Parse.date(first.lastReadAt) ?? Parse.date(first.addedAt) ?? .distantPast
                let secondDate = Parse.date(second.lastReadAt) ?? Parse.date(second.addedAt) ?? .distantPast
                return firstDate > secondDate
            case .addedAtAsc:
                return (Parse.date(first.addedAt) ?? .distantPast) < (Parse.date(second.addedAt) ?? .distantPast)
            case .titleAsc:
                return first.title.compare(second.title, options: [.caseInsensitive], range: nil, locale: locale) == .orderedAscending
            case .titleDesc:
                return second.title.compare(first.title, options: [.caseInsensitive], range: nil, locale: locale) == .orderedAscending
            case .addedAtDesc:
                return (Parse.date(first.addedAt) ?? .distantPast) > (Parse.date(second.addedAt) ?? .distantPast)
            }
        }
    }
}

public enum MangaBookError: LocalizedError {
    case pathOutsideRoot(String, String)
    case recordNotFound
    case crossRootRename

    public var errorDescription: String? {
        switch self {
        case .pathOutsideRoot(let path, let root): return "路径 \(path) 不在库根目录 \(root) 内"
        case .recordNotFound: return "漫画记录不存在"
        case .crossRootRename: return "作者目录重命名不能跨库"
        }
    }
}
