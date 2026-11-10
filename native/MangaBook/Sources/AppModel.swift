import AppKit
import Foundation
import MangaBookCore
import Observation

@MainActor
@Observable
final class AppModel {
    enum AppSection: Hashable {
        case library
        case organizer
    }

    struct SelectionRequest: Identifiable {
        let id = UUID()
        var mangaIDs: [String]
    }

    enum SidebarItem: Hashable {
        case all
        case authors
        case unsorted
        case author(String)
    }

    private(set) var service: MangaBookService?
    var startupError: String?

    var root: LibraryRoot?
    private(set) var allBooks: [MangaBook] = []
    private(set) var visibleBooks: [MangaBook] = []
    private(set) var tagsByMangaId: [String: [MangaTag]] = [:]
    private(set) var tags: [MangaTag] = []
    private(set) var tagCounts: [String: Int] = [:]
    private(set) var authors: [TargetDirectorySummary] = []
    private(set) var aliases: [DirectoryAlias] = []

    var section: AppSection = .library
    var selection: SidebarItem = .all {
        didSet {
            selectedIDs = []
            rebuildVisible()
        }
    }

    var selectedTag: String? = nil {
        didSet {
            selectedIDs = []
            rebuildVisible()
        }
    }

    var searchText: String = "" {
        didSet {
            selectedIDs = []
            rebuildVisible()
        }
    }

    var sort: MangaSort {
        didSet {
            UserDefaults.standard.set(sort.rawValue, forKey: Self.sortDefaultsKey)
            selectedIDs = []
            rebuildVisible()
        }
    }

    var isScanning = false
    var scanProgress: ScanProgressPayload?
    var errorMessage: String?
    var selectedIDs: Set<String> = []
    var readingBook: MangaBook?
    var tagEditorTarget: MangaBook?
    var setAuthorRequest: SelectionRequest?
    var moveRequest: SelectionRequest?
    var deleteRequest: SelectionRequest?
    var renameTarget: MangaBook?
    var showSettings = false

    private var scanTask: Task<Void, Never>?
    private static let sortDefaultsKey = "library.sort"

    init() {
        let storedSort = UserDefaults.standard.string(forKey: Self.sortDefaultsKey)
        sort = storedSort.flatMap(MangaSort.init(rawValue:)) ?? .addedAtDesc
        do {
            let s = try MangaBookService()
            service = s
            root = try s.root()
        } catch {
            startupError = error.localizedDescription
        }
        setupDownloadServer()
    }

    var authorsRootPath: String? {
        root.map { AuthorsLayout.resolveAuthorsPath(for: PathUtils.normalize($0.path)) }
    }

    var unsortedRootPath: String? {
        root.map { AuthorsLayout.resolveUnsortedPath(for: PathUtils.normalize($0.path)) }
    }

    var unsortedCount: Int {
        guard let path = unsortedRootPath else { return 0 }
        return allBooks.reduce(0) { $0 + (PathUtils.isInside($1.folderPath, path) ? 1 : 0) }
    }

    var authorsCount: Int {
        guard let path = authorsRootPath else { return 0 }
        return allBooks.reduce(0) { $0 + (PathUtils.isInside($1.folderPath, path) ? 1 : 0) }
    }

    var activeSelectionTitle: String {
        let base: String
        switch selection {
        case .all: base = "全部漫画"
        case .authors: base = "作者"
        case .unsorted: base = "未分类"
        case .author(let path): base = PathUtils.displayName(for: path)
        }
        if let selectedTag {
            return "\(base) · #\(selectedTag)"
        }
        return base
    }

    // MARK: - Lifecycle

    func bootstrap() async {
        setupDownloadServer()
        guard service != nil else { return }
        await reload()
    }

    private func setupDownloadServer() {
        LocalDownloadServer.shared.configure(
            onDownloadRequested: { [weak self] urlOrId in
                await MainActor.run {
                    if let item = self?.downloadHitomi(urlOrId: urlOrId) {
                        return DownloadManager.shared.serializedTask(id: item.id)
                    }
                    return nil
                }
            },
            taskProvider: {
                DownloadManager.shared.serializedTasks()
            },
            singleTaskProvider: { id in
                DownloadManager.shared.serializedTask(id: id)
            }
        )
        LocalDownloadServer.shared.start()
    }

    @discardableResult
    func downloadHitomi(urlOrId: String, preferArtistFolder: Bool = true) -> DownloadTaskItem? {
        let currentRoot = root?.path ?? (try? service?.root()?.path)
        guard let libraryRoot = currentRoot else {
            errorMessage = "请先选择或创建一个漫画库"
            return nil
        }
        return DownloadManager.shared.startDownload(
            urlOrId: urlOrId,
            libraryRoot: libraryRoot,
            preferArtistFolder: preferArtistFolder
        ) { [weak self] folderPath, tags in
            await MainActor.run {
                guard let self else { return }
                Task {
                    if let service = self.service, let root = self.root {
                        try? await service.scanner.syncImportedDirectories(
                            sourcePath: root.path,
                            directoryPaths: [folderPath]
                        )
                        await self.reload()
                        if let book = self.allBooks.first(where: { $0.folderPath == folderPath }) {
                            for tag in tags {
                                _ = try? service.tags.addToManga(mangaId: book.id, tagName: tag)
                            }
                            await self.reload()
                        }
                    }
                }
            }
        }
    }

    func handleIncomingURL(_ url: URL) {
        guard url.scheme == "mangabook" else { return }
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return }
        let action = components.host ?? components.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        if action == "download" {
            let target = components.queryItems?.first(where: { $0.name == "url" || $0.name == "id" })?.value
            if let target, !target.isEmpty {
                downloadHitomi(urlOrId: target)
            }
        }
    }

    func reload() async {
        guard let service else { return }
        do {
            root = try service.root()
            allBooks = try service.manga.list(MangaFilter(sort: sort))
            tagsByMangaId = try service.tags.listAllLinks()
            tags = try service.tags.list()
            tagCounts = Self.countTags(tagsByMangaId)
            authors = try service.authorDirectories()
            aliases = try service.aliases.list()
            rebuildVisible()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func rebuildVisible() {
        var books = allBooks
        switch selection {
        case .all:
            break
        case .authors:
            if let path = authorsRootPath {
                books = books.filter { PathUtils.isInside($0.folderPath, path) }
            }
        case .unsorted:
            if let path = unsortedRootPath {
                books = books.filter { PathUtils.isInside($0.folderPath, path) }
            }
        case .author(let directory):
            books = books.filter { PathUtils.isInside($0.folderPath, directory) }
        }

        if let selectedTag {
            let key = PathUtils.key(selectedTag)
            books = books.filter { book in
                (tagsByMangaId[book.id] ?? []).contains { PathUtils.key($0.name) == key }
            }
        }

        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if !query.isEmpty {
            books = books.filter {
                $0.title.lowercased().contains(query) || $0.folderPath.lowercased().contains(query)
            }
        }

        let locale = Locale(identifier: "zh-Hans-CN")
        switch sort {
        case .lastReadAtDesc:
            books.sort {
                let a = Parse.date($0.lastReadAt) ?? Parse.date($0.addedAt) ?? .distantPast
                let b = Parse.date($1.lastReadAt) ?? Parse.date($1.addedAt) ?? .distantPast
                return a > b
            }
        case .addedAtAsc:
            books.sort { (Parse.date($0.addedAt) ?? .distantPast) < (Parse.date($1.addedAt) ?? .distantPast) }
        case .titleAsc:
            books.sort { $0.title.compare($1.title, options: [.caseInsensitive], range: nil, locale: locale) == .orderedAscending }
        case .titleDesc:
            books.sort { $1.title.compare($0.title, options: [.caseInsensitive], range: nil, locale: locale) == .orderedAscending }
        case .addedAtDesc:
            books.sort { (Parse.date($0.addedAt) ?? .distantPast) > (Parse.date($1.addedAt) ?? .distantPast) }
        }
        visibleBooks = books
    }

    // MARK: - Library root

    func chooseLibraryRoot() {
        let panel = NSOpenPanel()
        panel.title = "选择或新建漫画库"
        panel.message = "选择一个目录作为漫画库（会创建 Authors / Unsorted 结构）"
        panel.prompt = "使用此目录"
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.allowsMultipleSelection = false
        panel.canCreateDirectories = true
        guard panel.runModal() == .OK, let url = panel.url else { return }
        Task { await applyRoot(url: url) }
    }

    func applyRoot(url: URL) async {
        guard let service else { return }
        do {
            let root = try service.setLibraryRoot(url)
            self.root = root
            selection = .all
            applyFolderIcon(to: root.path)
            await reload()
            await sync()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func applyFolderIcon(to path: String) {
        guard let iconURL = Bundle.main.url(forResource: "library-folder-icon", withExtension: "png"),
              let image = NSImage(contentsOf: iconURL) else { return }
        NSWorkspace.shared.setIcon(image, forFile: path, options: [])
    }

    func revealLibraryInFinder() {
        guard let root else { return }
        NSWorkspace.shared.activateFileViewerSelecting([URL(fileURLWithPath: root.path, isDirectory: true)])
    }

    // MARK: - Scanning

    func sync() async {
        guard let service, let root, !isScanning else { return }
        isScanning = true
        scanProgress = ScanProgressPayload(message: "准备扫描…")
        defer {
            isScanning = false
            scanProgress = nil
        }

        let task = Task { [weak self] in
            do {
                try await service.scanner.syncSources([root.path]) { payload in
                    Task { @MainActor [weak self] in
                        self?.scanProgress = payload
                    }
                }
            } catch is CancellationError {
                // User cancelled.
            } catch {
                await MainActor.run { [weak self] in
                    self?.errorMessage = error.localizedDescription
                }
            }
        }
        scanTask = task
        await task.value
        scanTask = nil
        await service.coverResolver.clear()
        await reload()
    }

    func cancelSync() {
        scanTask?.cancel()
    }

    // MARK: - Actions

    func openReader(_ book: MangaBook) {
        readingBook = book
    }

    func closeReader() {
        readingBook = nil
    }

    func authorName(for book: MangaBook) -> String? {
        guard let rootPath = root?.path else { return nil }
        let authorsRoot = AuthorsLayout.resolveAuthorsPath(for: PathUtils.normalize(rootPath))
        guard PathUtils.isInside(book.folderPath, authorsRoot),
              let relative = PathUtils.relativePath(from: authorsRoot, to: book.folderPath) else {
            return nil
        }
        return relative.split(separator: "/").first.map(String.init)
    }

    func requestSetAuthor(for book: MangaBook) {
        setAuthorRequest = SelectionRequest(mangaIDs: [book.id])
    }

    func requestSetAuthor(ids: [String]) {
        guard !ids.isEmpty else { return }
        setAuthorRequest = SelectionRequest(mangaIDs: ids)
    }

    func book(id: String) -> MangaBook? {
        allBooks.first { $0.id == id }
    }

    func reveal(_ book: MangaBook) {
        NSWorkspace.shared.activateFileViewerSelecting([book.folderURL])
    }

    func openFolder(_ book: MangaBook) {
        NSWorkspace.shared.open(book.folderURL)
    }

    func editTags(for book: MangaBook) {
        tagEditorTarget = book
    }

    func tags(for book: MangaBook) -> [MangaTag] {
        tagsByMangaId[book.id] ?? []
    }

    func tagCount(_ name: String) -> Int {
        tagCounts[PathUtils.key(name)] ?? 0
    }

    private static func countTags(_ links: [String: [MangaTag]]) -> [String: Int] {
        var counts: [String: Int] = [:]
        for tags in links.values {
            for tag in tags {
                counts[PathUtils.key(tag.name), default: 0] += 1
            }
        }
        return counts
    }

    func setTags(for book: MangaBook, names: [String]) async {
        guard let service else { return }
        do {
            _ = try service.tags.setForManga(mangaId: book.id, tagNames: names)
            tagsByMangaId = try service.tags.listAllLinks()
            tags = try service.tags.list()
            tagCounts = Self.countTags(tagsByMangaId)
            if selectedTag != nil { rebuildVisible() }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func copyPath(_ book: MangaBook) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(book.folderPath, forType: .string)
    }

    func updateBookProgress(id: String, pageIndex: Int, totalPages: Int) {
        guard let index = allBooks.firstIndex(where: { $0.id == id }) else { return }
        let current = allBooks[index]
        guard current.lastPageIndex != pageIndex || current.totalPages != totalPages else { return }
        allBooks[index].lastPageIndex = pageIndex
        allBooks[index].totalPages = totalPages
        allBooks[index].lastReadAt = ISO8601DateFormatter().string(from: Date())
        rebuildVisible()
    }

    func deleteManga(_ book: MangaBook) async {
        guard let service else { return }
        do {
            _ = try service.organizer.deleteManga(id: book.id, withFiles: true)
            await reload()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Library operations

    func requestMove(ids: [String]) {
        guard !ids.isEmpty else { return }
        moveRequest = SelectionRequest(mangaIDs: ids)
    }

    func requestDelete(ids: [String]) {
        guard !ids.isEmpty else { return }
        deleteRequest = SelectionRequest(mangaIDs: ids)
    }

    func moveMangas(ids: [String], to destination: String) async {
        guard let service, !ids.isEmpty else { return }
        do {
            _ = try service.organizer.moveMangas(ids: ids, to: destination)
            moveRequest = nil
            selectedIDs = []
            await reload()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func deleteMangas(ids: [String]) async {
        guard let service, !ids.isEmpty else { return }
        var failures: [String] = []
        for id in ids {
            do {
                _ = try service.organizer.deleteManga(id: id, withFiles: true)
            } catch {
                failures.append(error.localizedDescription)
            }
        }
        deleteRequest = nil
        selectedIDs = []
        await reload()
        if let first = failures.first {
            errorMessage = first
        }
    }

    func rename(_ book: MangaBook, to title: String) async {
        guard let service else { return }
        do {
            _ = try service.organizer.renameManga(id: book.id, newTitle: title)
            renameTarget = nil
            await reload()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Organizer

    func createAuthorDirectory(name: String) async -> String? {
        guard let service else { return nil }
        do {
            let result = try service.organizer.createAuthorDirectory(name: name)
            authors = try service.authorDirectories()
            return result.path
        } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }

    func renameAuthorDirectory(path: String, to name: String) async {
        guard let service else { return }
        do {
            _ = try service.organizer.renameAuthorDirectory(path: path, newName: name)
            await reload()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func mergeAuthorDirectories(paths: [String], targetName: String) async {
        guard let service else { return }
        do {
            let result = try service.organizer.mergeAuthorDirectories(paths: paths, targetName: targetName)
            await reload()
            if result.renamedConflictCount > 0 {
                errorMessage = "合并完成，但有 \(result.renamedConflictCount) 个重名目录已自动重命名。"
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func deleteAuthorDirectory(path: String) async {
        guard let service else { return }
        do {
            _ = try service.organizer.deleteAuthorDirectory(path: path)
            await reload()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func importMangas(into directory: String) async {
        guard let service else { return }
        let panel = NSOpenPanel()
        panel.title = "选择要导入的漫画目录"
        panel.message = "选择的目录会被移动进「\(PathUtils.displayName(for: directory))」"
        panel.prompt = "导入"
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.allowsMultipleSelection = true
        panel.canCreateDirectories = false
        guard panel.runModal() == .OK, !panel.urls.isEmpty else { return }

        do {
            let result = try service.organizer.importMangas(
                into: directory,
                from: panel.urls.map(\.path)
            )
            if let root = try service.activeRootPath() {
                try? await service.scanner.syncImportedDirectories(
                    sourcePath: root,
                    directoryPaths: [directory]
                )
            }
            await reload()
            if result.importedCount == 0 {
                let reasons = result.skipped.map { "\(PathUtils.displayName(for: $0.path))" }.joined(separator: "、")
                errorMessage = reasons.isEmpty ? "没有导入任何目录。" : "没有可导入的漫画目录：\(reasons)"
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func deleteTag(_ tag: MangaTag) async {
        guard let service else { return }
        do {
            _ = try service.tags.delete(id: tag.id)
            await reload()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func clearAllTags() async {
        guard let service else { return }
        do {
            _ = try service.tags.clearAll()
            await reload()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func upsertAlias(alias: String, canonicalName: String) async {
        guard let service else { return }
        do {
            _ = try service.aliases.upsert(alias: alias, canonicalName: canonicalName)
            aliases = try service.aliases.list()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func removeAlias(_ alias: String) async {
        guard let service else { return }
        do {
            _ = try service.aliases.remove(alias: alias)
            aliases = try service.aliases.list()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Web search

    enum WebProvider: String, CaseIterable {
        case hitomi
        case hitomiArtist
        case exhentai
        case google

        var label: String {
            switch self {
            case .hitomi: return "Hitomi"
            case .hitomiArtist: return "Hitomi 作者"
            case .exhentai: return "ExHentai"
            case .google: return "Google"
            }
        }
    }

    func openWebSearch(_ provider: WebProvider, query: String) {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        let encoded = trimmed.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? trimmed
        let urlString: String
        switch provider {
        case .hitomi: urlString = "https://hitomi.la/search.html?\(encoded)"
        case .hitomiArtist: urlString = "https://hitomi.la/artist/\(encoded)-all.html"
        case .exhentai: urlString = "https://exhentai.org/?f_search=\(encoded)"
        case .google: urlString = "https://www.google.com/search?q=\(encoded)"
        }
        guard let url = URL(string: urlString) else { return }
        NSWorkspace.shared.open(url)
    }
}
