import Foundation
import GRDB

public final class MangaBookService: @unchecked Sendable {
    public let libraryStore: LibraryStore
    public let sourceStore: SourceMetadataStore
    public let manga: MangaRepository
    public let tags: TagRepository
    public let bookmarks: BookmarkRepository
    public let aliases: AliasRepository
    public let directoryUsage: DirectoryUsageRepository
    public let reader: ReaderRepository
    public let coverResolver: CoverResolver
    public let scanner: SourceScanner
    public let organizer: OrganizerService

    public init(
        appSupportDirectory: URL = AppPaths.appSupportDirectory,
        metadataRoot: URL? = nil
    ) throws {
        libraryStore = try LibraryStore(
            databaseURL: AppPaths.legacyDatabaseURL(in: appSupportDirectory)
        )
        sourceStore = SourceMetadataStore(
            libraryStore: libraryStore,
            metadataRoot: metadataRoot ?? AppPaths.sourceMetadataRoot(in: appSupportDirectory)
        )
        manga = MangaRepository(store: sourceStore)
        tags = TagRepository(store: sourceStore)
        bookmarks = BookmarkRepository(store: sourceStore)
        aliases = AliasRepository(store: sourceStore)
        directoryUsage = DirectoryUsageRepository(store: sourceStore)
        reader = ReaderRepository(store: sourceStore, manga: manga)
        coverResolver = CoverResolver()
        scanner = SourceScanner(manga: manga, coverResolver: coverResolver)
        organizer = OrganizerService(
            libraryStore: libraryStore,
            sourceStore: sourceStore,
            manga: manga,
            directoryUsage: directoryUsage,
            aliases: aliases,
            coverResolver: coverResolver
        )
    }

    public func root() throws -> LibraryRoot? {
        try libraryStore.root()
    }

    public func activeRootPath() throws -> String? {
        try root().map { PathUtils.normalize($0.path) }
    }

    @discardableResult
    public func setLibraryRoot(_ url: URL) throws -> LibraryRoot {
        let path = PathUtils.normalize(url.path)
        guard FileSystem.isDirectory(path) else { throw LibraryError.directoryNotFound(path) }
        let structure = try Self.ensureLibraryStructure(rootPath: path)
        let displayName = Self.displayName(for: path)
        return try libraryStore.setRoot(
            path: path,
            displayName: displayName,
            hasCustomIcon: structure.hasCustomIcon
        )
    }

    public func createLibrary(atParent parent: URL, name: String) throws -> LibraryRoot {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw LibraryError.invalidName }
        let directoryName = trimmed.lowercased().hasSuffix(".mangalibrary") ? trimmed : "\(trimmed).mangalibrary"
        let url = parent.appendingPathComponent(directoryName, isDirectory: true)
        try FileSystem.ensureDirectory(url.path)
        return try setLibraryRoot(url)
    }

    public static func displayName(for path: String) -> String {
        let name = PathUtils.displayName(for: path)
        return name.lowercased().hasSuffix(".mangalibrary") ? String(name.dropLast(".mangalibrary".count)) : name
    }

    @discardableResult
    public static func ensureLibraryStructure(rootPath: String) throws -> (initializedAt: String, hasCustomIcon: Bool) {
        let authors = AuthorsLayout.authorsPath(for: rootPath)
        let unsorted = AuthorsLayout.unsortedPath(for: rootPath)
        let metadata = (rootPath as NSString).appendingPathComponent(MetadataDirectory.name)
        try FileSystem.ensureDirectory(rootPath)
        try FileSystem.ensureDirectory(authors)
        try FileSystem.ensureDirectory(unsorted)
        try FileSystem.ensureDirectory(metadata)

        let markerPath = (metadata as NSString).appendingPathComponent("library.json")
        var initializedAt = SQLValue.now()
        if let data = FileManager.default.contents(atPath: markerPath),
           let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let existing = object["initializedAt"] as? String {
            initializedAt = existing
        }

        let marker: [String: Any] = [
            "initializedAt": initializedAt,
            "app": "manga-book",
            "structure": ["authors": "Authors", "unsorted": "Unsorted"],
            "hasCustomIcon": false
        ]
        if let data = try? JSONSerialization.data(withJSONObject: marker, options: [.prettyPrinted]) {
            try? data.write(to: URL(fileURLWithPath: markerPath))
        }
        return (initializedAt, false)
    }

    // MARK: - Library browsing helpers

    public func authorDirectories() throws -> [TargetDirectorySummary] {
        guard let rootPath = try activeRootPath() else { return [] }
        let authorsPath = AuthorsLayout.resolveAuthorsPath(for: rootPath)
        guard FileSystem.isDirectory(authorsPath) else { return [] }

        let directories = try FileSystem.listDirectories(authorsPath)
            .filter { !MetadataDirectory.isMetadataDirectory($0) }
            .sorted { $0.localizedStandardCompare($1) == .orderedAscending }
        var counts: [String: Int] = [:]
        for directory in directories { counts[directory] = 0 }

        for book in try manga.list(MangaFilter(sort: .titleAsc)) {
            guard PathUtils.isInside(book.folderPath, authorsPath),
                  let relative = PathUtils.relativePath(from: authorsPath, to: book.folderPath) else { continue }
            guard let author = relative.split(separator: "/").first.map(String.init) else { continue }
            let directory = PathUtils.join(authorsPath, author)
            counts[directory, default: 0] += 1
        }

        return directories.map { directory in
            TargetDirectorySummary(
                directory: directory,
                mangaCount: counts[directory] ?? 0,
                lastMovedAt: (try? directoryUsage.lastMovedAt(directoryPath: directory, sourceRoot: rootPath)) ?? nil
            )
        }
    }

    public func tagsByMangaId(_ mangaIds: [String]) throws -> [String: [MangaTag]] {
        try tags.listByMangaIds(mangaIds)
    }
}

public enum LibraryError: LocalizedError {
    case directoryNotFound(String)
    case invalidName
    case noLibrary

    public var errorDescription: String? {
        switch self {
        case .directoryNotFound(let path): return "目录不存在：\(path)"
        case .invalidName: return "名称无效"
        case .noLibrary: return "请先设置漫画库。"
        }
    }
}
