import Foundation
import GRDB

public final class ReaderRepository: @unchecked Sendable {
    private struct StoredManualChapter: Codable {
        var id: String
        var startPageRelativePath: String
        var createdAt: String
    }

    private struct StoredChapterMetadata: Codable {
        var id: String
        var title: String?
        var highlighted: Bool
        var updatedAt: String
    }

    private static let manualChaptersPrefix = "reader_manual_chapters:"
    private static let chapterMetadataPrefix = "reader_chapter_metadata:"
    private static let maxTitleLength = 120

    private let store: SourceMetadataStore
    private let manga: MangaRepository

    public init(store: SourceMetadataStore, manga: MangaRepository) {
        self.store = store
        self.manga = manga
    }

    public func listPages(mangaId: String) throws -> [String] {
        guard let book = try manga.getById(mangaId) else { throw MangaBookError.recordNotFound }
        return try listPagePaths(for: book)
    }

    public func listPagePaths(for book: MangaBook) throws -> [String] {
        if book.structure == .multiVolume {
            let childDirectories = try FileSystem.listDirectories(book.folderPath)
                .sorted { $0.localizedStandardCompare($1) == .orderedAscending }
            return try childDirectories.flatMap { try listImagePaths($0) }
        }
        return try listImagePaths(book.folderPath)
    }

    public func listChapters(mangaId: String) throws -> [ReaderChapter] {
        guard let book = try manga.getById(mangaId) else { throw MangaBookError.recordNotFound }
        return try listChapters(for: book)
    }

    public func listChapters(for book: MangaBook) throws -> [ReaderChapter] {
        let base = try listBaseChapters(for: book)
        guard !base.isEmpty else { return [] }
        let queue = try store.database(for: book.sourceFolderPath)
        let metadata = try readChapterMetadata(queue: queue, mangaId: book.id)
        return applyMetadata(base, metadata: metadata)
    }

    public func addChapter(mangaId: String, pageIndex: Int) throws -> [ReaderChapter] {
        guard let book = try manga.getById(mangaId) else { throw MangaBookError.recordNotFound }
        guard book.structure == .singleVolume else { throw ReaderError.unsupported }
        let pagePaths = try listImagePaths(book.folderPath)
        guard !pagePaths.isEmpty else { throw ReaderError.noPages }
        guard pageIndex > 0, pageIndex < pagePaths.count else { throw ReaderError.invalidPage }
        guard let relative = PathUtils.relativePath(from: book.folderPath, to: pagePaths[pageIndex]) else {
            throw ReaderError.invalidPage
        }

        let queue = try store.database(for: book.sourceFolderPath)
        var stored = try readManualChapters(queue: queue, mangaId: book.id)
        guard !stored.contains(where: { $0.startPageRelativePath == relative }) else { throw ReaderError.duplicateChapter }
        stored.append(StoredManualChapter(id: UUID().uuidString, startPageRelativePath: relative, createdAt: SQLValue.now()))
        try writeManualChapters(queue: queue, mangaId: book.id, chapters: stored)
        return try listChapters(for: book)
    }

    public func removeChapter(mangaId: String, chapterId: String) throws -> [ReaderChapter] {
        guard let book = try manga.getById(mangaId) else { throw MangaBookError.recordNotFound }
        guard book.structure == .singleVolume else { throw ReaderError.unsupported }
        guard !chapterId.isEmpty, !chapterId.hasPrefix("generated:") else { throw ReaderError.invalidChapter }

        let queue = try store.database(for: book.sourceFolderPath)
        var stored = try readManualChapters(queue: queue, mangaId: book.id)
        let before = stored.count
        stored.removeAll { $0.id == chapterId }
        guard stored.count != before else { throw ReaderError.chapterNotFound }
        try writeManualChapters(queue: queue, mangaId: book.id, chapters: stored)
        var metadata = try readChapterMetadata(queue: queue, mangaId: book.id)
        metadata.removeAll { $0.id == chapterId }
        try writeChapterMetadata(queue: queue, mangaId: book.id, items: metadata)
        return try listChapters(for: book)
    }

    public func updateChapter(
        mangaId: String,
        chapterId: String,
        title: String?,
        highlighted: Bool?
    ) throws -> [ReaderChapter] {
        guard let book = try manga.getById(mangaId) else { throw MangaBookError.recordNotFound }
        guard !chapterId.isEmpty else { throw ReaderError.invalidChapter }
        guard title != nil || highlighted != nil else { throw ReaderError.nothingToUpdate }

        let base = try listBaseChapters(for: book)
        guard let target = base.first(where: { $0.id == chapterId }) else { throw ReaderError.chapterNotFound }

        let queue = try store.database(for: book.sourceFolderPath)
        let metadata = try readChapterMetadata(queue: queue, mangaId: book.id)
        let current = metadata.first { $0.id == chapterId }

        let titleInput: String?
        if let titleUpdate = title {
            titleInput = Self.normalizeTitle(titleUpdate)
        } else {
            titleInput = current?.title
        }
        let nextTitle = titleInput == target.title ? nil : titleInput
        let nextHighlighted = highlighted ?? current?.highlighted ?? false

        var next = metadata.filter { $0.id != chapterId }
        if nextTitle != nil || nextHighlighted {
            next.append(StoredChapterMetadata(
                id: chapterId,
                title: nextTitle,
                highlighted: nextHighlighted,
                updatedAt: SQLValue.now()
            ))
        }
        try writeChapterMetadata(queue: queue, mangaId: book.id, items: next)
        return try listChapters(for: book)
    }

    @discardableResult
    public func deletePages(mangaId: String, pagePaths requested: [String]) throws -> (deleted: Int, total: Int) {
        guard let book = try manga.getById(mangaId) else { throw MangaBookError.recordNotFound }
        let unique = Array(Set(requested.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }))
        guard !unique.isEmpty else { throw ReaderError.noPagesSelected }

        let current = try listPagePaths(for: book)
        let currentSet = Set(current)
        guard unique.allSatisfy({ currentSet.contains($0) }) else { throw ReaderError.foreignPage }
        guard unique.count < current.count else { throw ReaderError.mustKeepOnePage }

        for path in unique {
            try FileManager.default.trashItem(at: URL(fileURLWithPath: path), resultingItemURL: nil)
        }

        let remaining = current.count - unique.count
        try manga.updateProgress(
            mangaId: mangaId,
            chapterIndex: book.lastChapterIndex,
            pageIndex: min(book.lastPageIndex, remaining - 1),
            totalPages: remaining
        )
        return (unique.count, remaining)
    }

    public func saveProgress(mangaId: String, chapterIndex: Int, pageIndex: Int, totalPages: Int) throws {
        try manga.updateProgress(mangaId: mangaId, chapterIndex: chapterIndex, pageIndex: pageIndex, totalPages: totalPages)
    }

    // MARK: - Chapters

    private func listBaseChapters(for book: MangaBook) throws -> [ReaderChapter] {
        if book.structure == .multiVolume {
            let childDirectories = try FileSystem.listDirectories(book.folderPath)
                .sorted { $0.localizedStandardCompare($1) == .orderedAscending }
            var chapters: [ReaderChapter] = []
            var start = 0
            for child in childDirectories {
                let pages = try listImagePaths(child)
                guard !pages.isEmpty else { continue }
                let relative = PathUtils.relativePath(from: book.folderPath, to: child) ?? PathUtils.displayName(for: child)
                chapters.append(ReaderChapter(
                    id: "filesystem:\(relative)",
                    title: PathUtils.displayName(for: child),
                    startPageIndex: start,
                    endPageIndex: start + pages.count - 1,
                    pageCount: pages.count,
                    source: .filesystem,
                    highlighted: false,
                    deletable: false
                ))
                start += pages.count
            }
            return chapters
        }

        let pagePaths = try listImagePaths(book.folderPath)
        guard !pagePaths.isEmpty else { return [] }
        let queue = try store.database(for: book.sourceFolderPath)
        let stored = try readManualChapters(queue: queue, mangaId: book.id)
        guard !stored.isEmpty else { return [] }

        var indexByRelative: [String: Int] = [:]
        for (index, path) in pagePaths.enumerated() {
            if let relative = PathUtils.relativePath(from: book.folderPath, to: path) {
                indexByRelative[relative] = index
            }
        }

        var boundaries: [(index: Int, chapter: StoredManualChapter)] = []
        var seen: Set<Int> = []
        for chapter in stored {
            guard let index = indexByRelative[chapter.startPageRelativePath], !seen.contains(index) else { continue }
            seen.insert(index)
            boundaries.append((index, chapter))
        }
        boundaries.sort { $0.index < $1.index }
        guard !boundaries.isEmpty else { return [] }

        struct Start {
            var id: String
            var pageIndex: Int
            var source: ReaderChapter.Source
            var deletable: Bool
        }

        var starts: [Start] = boundaries.map {
            Start(id: $0.chapter.id, pageIndex: $0.index, source: .manual, deletable: true)
        }
        if !starts.contains(where: { $0.pageIndex == 0 }) {
            starts.insert(Start(id: "generated:start", pageIndex: 0, source: .generated, deletable: false), at: 0)
        }

        return starts.enumerated().map { index, start in
            let nextStart = index + 1 < starts.count ? starts[index + 1].pageIndex : pagePaths.count
            let end = max(start.pageIndex, nextStart - 1)
            return ReaderChapter(
                id: start.id,
                title: "第 \(index + 1) 章",
                startPageIndex: start.pageIndex,
                endPageIndex: end,
                pageCount: end - start.pageIndex + 1,
                source: start.source,
                highlighted: false,
                deletable: start.deletable
            )
        }
    }

    private func applyMetadata(_ chapters: [ReaderChapter], metadata: [StoredChapterMetadata]) -> [ReaderChapter] {
        let byId = Dictionary(uniqueKeysWithValues: metadata.map { ($0.id, $0) })
        return chapters.map { chapter in
            var result = chapter
            if let item = byId[chapter.id] {
                if let title = item.title { result.title = title }
                result.highlighted = item.highlighted
            }
            return result
        }
    }

    private func listImagePaths(_ directory: String) throws -> [String] {
        let files = try FileSystem.listImageFiles(directory)
        return files.sorted { $0.localizedStandardCompare($1) == .orderedAscending }
    }

    // MARK: - source_metadata JSON

    private func readValue(queue: DatabaseQueue, key: String) throws -> String? {
        try queue.read { db in
            try String.fetchOne(db, sql: "SELECT value FROM source_metadata WHERE key = ? LIMIT 1", arguments: [key])
        }
    }

    private func writeValue(queue: DatabaseQueue, key: String, value: String?) throws {
        try queue.write { db in
            if let value {
                try db.execute(
                    sql: """
                    INSERT INTO source_metadata (key, value, updated_at) VALUES (?, ?, ?)
                    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
                    """,
                    arguments: [key, value, SQLValue.now()]
                )
            } else {
                try db.execute(sql: "DELETE FROM source_metadata WHERE key = ?", arguments: [key])
            }
        }
    }

    private func readManualChapters(queue: DatabaseQueue, mangaId: String) throws -> [StoredManualChapter] {
        guard let raw = try readValue(queue: queue, key: Self.manualChaptersPrefix + mangaId),
              let data = raw.data(using: .utf8),
              let decoded = try? JSONDecoder().decode([StoredManualChapter].self, from: data) else {
            return []
        }
        return decoded.filter { !$0.id.isEmpty && !$0.startPageRelativePath.isEmpty }
    }

    private func writeManualChapters(queue: DatabaseQueue, mangaId: String, chapters: [StoredManualChapter]) throws {
        guard !chapters.isEmpty else {
            try writeValue(queue: queue, key: Self.manualChaptersPrefix + mangaId, value: nil)
            return
        }
        let data = try JSONEncoder().encode(chapters)
        try writeValue(queue: queue, key: Self.manualChaptersPrefix + mangaId, value: String(data: data, encoding: .utf8))
    }

    private func readChapterMetadata(queue: DatabaseQueue, mangaId: String) throws -> [StoredChapterMetadata] {
        guard let raw = try readValue(queue: queue, key: Self.chapterMetadataPrefix + mangaId),
              let data = raw.data(using: .utf8),
              let decoded = try? JSONDecoder().decode([StoredChapterMetadata].self, from: data) else {
            return []
        }
        return decoded.filter { !$0.id.isEmpty }
    }

    private func writeChapterMetadata(queue: DatabaseQueue, mangaId: String, items: [StoredChapterMetadata]) throws {
        let normalized = items.filter { !$0.id.isEmpty && ($0.title != nil || $0.highlighted) }
        guard !normalized.isEmpty else {
            try writeValue(queue: queue, key: Self.chapterMetadataPrefix + mangaId, value: nil)
            return
        }
        let data = try JSONEncoder().encode(normalized)
        try writeValue(queue: queue, key: Self.chapterMetadataPrefix + mangaId, value: String(data: data, encoding: .utf8))
    }

    private static func normalizeTitle(_ value: String?) -> String? {
        guard let value else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        return String(trimmed.prefix(maxTitleLength))
    }
}

public enum ReaderError: LocalizedError {
    case unsupported
    case noPages
    case invalidPage
    case duplicateChapter
    case invalidChapter
    case chapterNotFound
    case nothingToUpdate
    case noPagesSelected
    case foreignPage
    case mustKeepOnePage

    public var errorDescription: String? {
        switch self {
        case .unsupported: return "当前漫画已按目录分章节，暂不支持该操作。"
        case .noPages: return "当前漫画没有可分章的页面。"
        case .invalidPage: return "章节起始页无效。"
        case .duplicateChapter: return "当前页已经是章节起点。"
        case .invalidChapter: return "该章节不能删除或修改。"
        case .chapterNotFound: return "章节不存在。"
        case .nothingToUpdate: return "未提供章节更新内容。"
        case .noPagesSelected: return "请选择要删除的页面。"
        case .foreignPage: return "包含不属于当前漫画的页面，无法删除。"
        case .mustKeepOnePage: return "至少需要保留 1 页漫画。"
        }
    }
}
