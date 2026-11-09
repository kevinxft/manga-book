import Foundation

public struct MoveMangaResult: Sendable {
    public var manga: MangaBook
    public var renamedDueToConflict: Bool
}

public struct MergeAuthorDirectoriesResult: Sendable {
    public var targetPath: String
    public var targetName: String
    public var movedCount: Int
    public var deletedSourcePaths: [String]
    public var renamedConflictCount: Int
    public var aliases: [DirectoryAlias]
}

public struct ImportMangasResult: Sendable {
    public var importedCount: Int
    public var renamedConflictCount: Int
    public var skipped: [(path: String, reason: String)]
    public var targetPaths: [String]
}

public final class OrganizerService: @unchecked Sendable {
    private let libraryStore: LibraryStore
    private let sourceStore: SourceMetadataStore
    private let manga: MangaRepository
    private let directoryUsage: DirectoryUsageRepository
    private let coverResolver: CoverResolver
    private let aliases: AliasRepository

    public init(
        libraryStore: LibraryStore,
        sourceStore: SourceMetadataStore,
        manga: MangaRepository,
        directoryUsage: DirectoryUsageRepository,
        aliases: AliasRepository,
        coverResolver: CoverResolver
    ) {
        self.libraryStore = libraryStore
        self.sourceStore = sourceStore
        self.manga = manga
        self.directoryUsage = directoryUsage
        self.aliases = aliases
        self.coverResolver = coverResolver
    }

    private var libraryRoot: String? {
        (try? libraryStore.root()).map { PathUtils.normalize($0.path) }
    }

    // MARK: - Manga operations

    public func moveManga(id: String, destinationPath: String) throws -> MoveMangaResult {
        guard let book = try manga.getById(id) else { throw MangaBookError.recordNotFound }
        let destinationRoot = PathUtils.normalize(destinationPath)
        try FileSystem.ensureDirectory(destinationRoot)

        let target = try availableDirectoryPath(
            destinationRoot: destinationRoot,
            preferredName: PathUtils.displayName(for: book.folderPath),
            currentPath: book.folderPath
        )
        try FileSystem.move(book.folderPath, to: target.path)
        awaitInvalidate(book.folderPath)

        let nextSource = resolveSourceFolderPath(nextFolderPath: target.path, fallback: book.sourceFolderPath)
        let updated = try manga.updatePath(
            id: book.id,
            title: PathUtils.displayName(for: target.path),
            folderPath: target.path,
            sourceFolderPath: nextSource
        )
        try? directoryUsage.touch(directoryPath: destinationRoot, sourceRoot: nextSource)
        return MoveMangaResult(manga: updated, renamedDueToConflict: target.renamed)
    }

    public func renameManga(id: String, newTitle: String) throws -> MangaBook {
        guard let book = try manga.getById(id) else { throw MangaBookError.recordNotFound }
        let trimmed = newTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, trimmed != ".", trimmed != "..", !trimmed.contains("/") else {
            throw OrganizerError.invalidName
        }
        let parent = (book.folderPath as NSString).deletingLastPathComponent
        let nextPath = PathUtils.normalize((parent as NSString).appendingPathComponent(trimmed))
        guard nextPath != book.folderPath else { return book }
        guard !FileSystem.exists(nextPath) else { throw OrganizerError.destinationExists(nextPath) }

        try FileSystem.move(book.folderPath, to: nextPath)
        awaitInvalidate(book.folderPath)
        let nextSource = resolveSourceFolderPath(nextFolderPath: nextPath, fallback: book.sourceFolderPath)
        return try manga.updatePath(id: book.id, title: trimmed, folderPath: nextPath, sourceFolderPath: nextSource)
    }

    @discardableResult
    public func deleteManga(id: String, withFiles: Bool) throws -> Bool {
        guard let book = try manga.getById(id) else { throw MangaBookError.recordNotFound }
        if withFiles {
            try FileManager.default.trashItem(at: book.folderURL, resultingItemURL: nil)
        }
        awaitInvalidate(book.folderPath)
        return try manga.deleteById(book.id)
    }

    // MARK: - Author directories

    public func createAuthorDirectory(name: String) throws -> (path: String, created: Bool) {
        guard let root = libraryRoot else { throw LibraryError.noLibrary }
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, trimmed != ".", trimmed != "..", !trimmed.contains("/") else {
            throw OrganizerError.invalidName
        }
        let authorsRoot = AuthorsLayout.resolveAuthorsPath(for: root)
        try FileSystem.ensureDirectory(authorsRoot)
        let target = PathUtils.join(authorsRoot, trimmed)
        if FileSystem.exists(target) {
            return (target, false)
        }
        try FileSystem.ensureDirectory(target)
        return (target, true)
    }

    public func renameAuthorDirectory(path: String, newName: String) throws -> (path: String, updatedCount: Int) {
        let currentPath = PathUtils.normalize(path)
        let trimmed = newName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, trimmed != ".", trimmed != "..", !trimmed.contains("/") else {
            throw OrganizerError.invalidName
        }
        guard FileSystem.isDirectory(currentPath) else { throw OrganizerError.directoryNotFound(currentPath) }
        let parent = (currentPath as NSString).deletingLastPathComponent
        let nextPath = PathUtils.normalize((parent as NSString).appendingPathComponent(trimmed))
        guard nextPath != currentPath else { return (currentPath, 0) }
        guard !FileSystem.exists(nextPath) else { throw OrganizerError.destinationExists(nextPath) }

        try FileSystem.move(currentPath, to: nextPath)
        let updated = try manga.renameDirectoryPrefix(previousDirectoryPath: currentPath, nextDirectoryPath: nextPath)
        awaitInvalidate(currentPath)
        _ = try? aliases.upsert(alias: PathUtils.displayName(for: currentPath), canonicalName: trimmed)
        return (nextPath, updated)
    }

    public func deleteAuthorDirectory(path: String) throws -> Bool {
        let directory = PathUtils.normalize(path)
        guard FileSystem.isDirectory(directory) else { throw OrganizerError.directoryNotFound(directory) }
        guard let root = libraryRoot else { throw LibraryError.noLibrary }
        let authorsRoot = AuthorsLayout.resolveAuthorsPath(for: root)
        guard (directory as NSString).deletingLastPathComponent == authorsRoot else {
            throw OrganizerError.invalidName
        }

        let mangaCount = try manga.list().filter { PathUtils.isInside($0.folderPath, directory) }.count
        guard mangaCount == 0 else { throw OrganizerError.directoryHasManga(directory) }

        _ = try? aliases.removeCanonical(PathUtils.displayName(for: directory))
        try FileManager.default.trashItem(
            at: URL(fileURLWithPath: directory, isDirectory: true),
            resultingItemURL: nil
        )
        awaitInvalidate(directory)
        return true
    }

    @discardableResult
    public func moveMangas(ids: [String], to destinationPath: String) throws -> Int {
        var moved = 0
        for id in ids {
            _ = try moveManga(id: id, destinationPath: destinationPath)
            moved += 1
        }
        return moved
    }

    // MARK: - Merge

    public func mergeAuthorDirectories(paths: [String], targetName: String) throws -> MergeAuthorDirectoriesResult {
        let sources = Array(Set(paths.map(PathUtils.normalize).filter { !$0.isEmpty }))
        let trimmedTarget = targetName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard sources.count >= 2 else { throw OrganizerError.mergeNeedsTwoDirectories }
        guard !trimmedTarget.isEmpty, trimmedTarget != ".", trimmedTarget != "..", !trimmedTarget.contains("/") else {
            throw OrganizerError.invalidName
        }

        let parent = (sources[0] as NSString).deletingLastPathComponent
        for source in sources {
            guard (source as NSString).deletingLastPathComponent == parent else {
                throw OrganizerError.mergeDifferentParents
            }
            guard FileSystem.isDirectory(source) else { throw OrganizerError.directoryNotFound(source) }
            if source == PathUtils.join(parent, trimmedTarget) { continue }
            let entries = try FileManager.default.contentsOfDirectory(atPath: source)
            for entry in entries {
                if entry == ".DS_Store" || entry == ".mangabook-author.json" { continue }
                let full = (source as NSString).appendingPathComponent(entry)
                guard FileSystem.isDirectory(full) else {
                    throw OrganizerError.directoryNotEmpty("\(PathUtils.displayName(for: source))/\(entry)")
                }
            }
        }

        let targetPath = PathUtils.join(parent, trimmedTarget)
        if FileSystem.exists(targetPath), !FileSystem.isDirectory(targetPath) {
            throw OrganizerError.destinationExists(targetPath)
        }
        try FileSystem.ensureDirectory(targetPath)

        var movedCount = 0
        var renamedConflictCount = 0
        var deletedSourcePaths: [String] = []

        for source in sources where source != targetPath {
            let children = (try? FileSystem.listDirectories(source)) ?? []
                .filter { !MetadataDirectory.isMetadataDirectory($0) }
            for child in children {
                let target = try availableDirectoryPath(
                    destinationRoot: targetPath,
                    preferredName: PathUtils.displayName(for: child),
                    currentPath: nil
                )
                try FileSystem.move(child, to: target.path)
                if target.renamed { renamedConflictCount += 1 }

                // A moved child can itself be a multi-volume container, so rewrite
                // every record under the old prefix, not just an exact match.
                awaitInvalidate(child)
                _ = try manga.renameDirectoryPrefix(
                    previousDirectoryPath: child,
                    nextDirectoryPath: target.path
                )
                try manga.updateTitle(
                    folderPath: target.path,
                    title: PathUtils.displayName(for: target.path)
                )
                awaitInvalidate(target.path)
                movedCount += 1
            }

            for ignorable in [".DS_Store", ".mangabook-author.json"] {
                try? FileManager.default.removeItem(
                    atPath: (source as NSString).appendingPathComponent(ignorable)
                )
            }
            try? FileManager.default.removeItem(atPath: source)
            deletedSourcePaths.append(source)
        }

        if movedCount > 0, let root = libraryRoot {
            try? directoryUsage.touch(directoryPath: targetPath, sourceRoot: root)
        }

        var storedAliases: [DirectoryAlias] = []
        for source in sources where source != targetPath {
            let sourceName = PathUtils.displayName(for: source)
            if PathUtils.key(sourceName) != PathUtils.key(trimmedTarget) {
                if let alias = try? aliases.upsert(alias: sourceName, canonicalName: trimmedTarget) {
                    storedAliases.append(alias)
                }
            }
        }

        awaitInvalidate(targetPath)
        return MergeAuthorDirectoriesResult(
            targetPath: targetPath,
            targetName: trimmedTarget,
            movedCount: movedCount,
            deletedSourcePaths: deletedSourcePaths,
            renamedConflictCount: renamedConflictCount,
            aliases: storedAliases
        )
    }

    // MARK: - Import

    public func importMangas(into directoryPath: String, from selectedPaths: [String]) throws -> ImportMangasResult {
        let targetDirectory = PathUtils.normalize(directoryPath)
        guard FileSystem.isDirectory(targetDirectory) else {
            throw OrganizerError.directoryNotFound(targetDirectory)
        }
        guard let root = libraryRoot else { throw LibraryError.noLibrary }

        let selected = Array(Set(selectedPaths.map(PathUtils.normalize).filter { !$0.isEmpty }))
        var importedCount = 0
        var renamedConflictCount = 0
        var skipped: [(path: String, reason: String)] = []
        var targetPaths: [String] = []

        for path in selected {
            if path == targetDirectory || PathUtils.isInside(path, targetDirectory) {
                skipped.append((path, "ALREADY_IN_TARGET"))
                continue
            }
            guard FileSystem.isDirectory(path) else {
                skipped.append((path, "NOT_FOUND"))
                continue
            }
            guard let inspection = try inspectImportableMangaDirectory(path) else {
                skipped.append((path, "INVALID_MANGA_DIRECTORY"))
                continue
            }

            let target = try availableDirectoryPath(
                destinationRoot: targetDirectory,
                preferredName: PathUtils.displayName(for: path),
                currentPath: nil
            )
            try FileSystem.move(path, to: target.path)
            importedCount += 1
            if target.renamed { renamedConflictCount += 1 }
            targetPaths.append(target.path)

            awaitInvalidate(path)
            let rewritten = try manga.renameDirectoryPrefix(
                previousDirectoryPath: path,
                nextDirectoryPath: target.path
            )
            if rewritten == 0 {
                _ = try manga.upsert(UpsertMangaInput(
                    title: PathUtils.displayName(for: target.path),
                    folderPath: target.path,
                    sourceFolderPath: root,
                    structure: inspection.structure,
                    totalPages: inspection.totalPages
                ))
            } else {
                try manga.updateTitle(
                    folderPath: target.path,
                    title: PathUtils.displayName(for: target.path)
                )
            }
            awaitInvalidate(target.path)
        }

        if importedCount > 0 {
            try? directoryUsage.touch(directoryPath: targetDirectory, sourceRoot: root)
        }

        return ImportMangasResult(
            importedCount: importedCount,
            renamedConflictCount: renamedConflictCount,
            skipped: skipped,
            targetPaths: targetPaths
        )
    }

    public func inspectImportableMangaDirectory(_ directoryPath: String) throws -> SourceScanner.FolderInspection? {
        let directImages = (try? FileSystem.listImageFiles(directoryPath)) ?? []
        if directImages.count >= SourceScanner.minimumMangaImageCount {
            return SourceScanner.FolderInspection(structure: .singleVolume, totalPages: directImages.count)
        }

        let children = ((try? FileSystem.listDirectories(directoryPath)) ?? [])
            .filter { !MetadataDirectory.isMetadataDirectory($0) }
        var totalPages = 0
        var hasVolume = false
        for child in children {
            let images = (try? FileSystem.listImageFiles(child)) ?? []
            guard !images.isEmpty else { continue }
            hasVolume = true
            totalPages += images.count
        }
        guard hasVolume else { return nil }
        return SourceScanner.FolderInspection(structure: .multiVolume, totalPages: totalPages)
    }

    // MARK: - Helpers

    private func resolveSourceFolderPath(nextFolderPath: String, fallback: String) -> String {
        let normalized = PathUtils.normalize(nextFolderPath)
        let candidates = sourceStore.registeredRoots().sorted { $0.count > $1.count }
        for candidate in candidates where PathUtils.isInside(normalized, candidate) {
            return candidate
        }
        return PathUtils.normalize(fallback)
    }

    private func availableDirectoryPath(
        destinationRoot: String,
        preferredName: String,
        currentPath: String?
    ) throws -> (path: String, renamed: Bool) {
        let normalizedCurrent = currentPath.map(PathUtils.normalize)
        for index in 0..<10_000 {
            let candidateName = index == 0 ? preferredName : "\(preferredName)（\(index)）"
            let candidatePath = PathUtils.join(destinationRoot, candidateName)
            if let normalizedCurrent, candidatePath == normalizedCurrent {
                return (candidatePath, false)
            }
            if !FileSystem.exists(candidatePath) {
                return (candidatePath, index > 0)
            }
        }
        throw OrganizerError.nameResolutionFailed(preferredName)
    }

    private func awaitInvalidate(_ path: String) {
        Task { await coverResolver.invalidate(path) }
    }
}

public enum OrganizerError: LocalizedError {
    case invalidName
    case destinationExists(String)
    case directoryNotFound(String)
    case directoryNotEmpty(String)
    case directoryHasManga(String)
    case mergeNeedsTwoDirectories
    case mergeDifferentParents
    case nameResolutionFailed(String)

    public var errorDescription: String? {
        switch self {
        case .invalidName: return "名称无效"
        case .destinationExists(let path): return "目标已存在：\(path)"
        case .directoryNotFound(let path): return "目录不存在：\(path)"
        case .directoryNotEmpty(let path): return "目录包含无法合并的文件：\(path)"
        case .directoryHasManga(let path): return "该作者目录下还有漫画，不能删除：\(path)"
        case .mergeNeedsTwoDirectories: return "至少选择两个作者目录才能合并"
        case .mergeDifferentParents: return "只能合并同一 Authors 根目录下的作者目录"
        case .nameResolutionFailed(let name): return "无法为 \(name) 生成可用的目录名"
        }
    }
}
