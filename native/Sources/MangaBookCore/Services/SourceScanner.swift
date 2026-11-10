import Foundation

public final class SourceScanner: @unchecked Sendable {
    public static let minimumMangaImageCount = 4

    private let manga: MangaRepository
    private let coverResolver: CoverResolver

    public init(manga: MangaRepository, coverResolver: CoverResolver) {
        self.manga = manga
        self.coverResolver = coverResolver
    }

    public struct FolderInspection: Sendable {
        public var structure: MangaStructure
        public var totalPages: Int

        public init(structure: MangaStructure, totalPages: Int) {
            self.structure = structure
            self.totalPages = totalPages
        }
    }

    struct MangaEntry {
        var folderPath: String
        var inspection: FolderInspection
    }

    public func syncSources(
        _ sourcePaths: [String],
        progress: (@Sendable (ScanProgressPayload) -> Void)? = nil
    ) async throws {
        let total = sourcePaths.count
        var current = 0
        for sourcePath in sourcePaths {
            try Task.checkCancellation()
            current += 1
            let sourceName = PathUtils.displayName(for: sourcePath)
            progress?(ScanProgressPayload(
                current: current, total: total, message: "正在扫描 \(sourceName)",
                sourceCurrent: current, sourceTotal: total, sourceName: sourceName
            ))
            try await syncSingleSource(sourcePath, sourceCurrent: current, sourceTotal: total, progress: progress)
        }
        progress?(ScanProgressPayload(
            current: total, total: total,
            message: total > 0 ? "扫描完成" : "没有可扫描的来源",
            sourceCurrent: total, sourceTotal: total
        ))
    }

    private func syncSingleSource(
        _ sourcePath: String,
        sourceCurrent: Int,
        sourceTotal: Int,
        progress: (@Sendable (ScanProgressPayload) -> Void)?
    ) async throws {
        let normalizedSourcePath = PathUtils.normalize(sourcePath)
        guard FileSystem.isDirectory(normalizedSourcePath) else {
            try manga.deleteBySource(normalizedSourcePath)
            return
        }

        let sourceName = PathUtils.displayName(for: normalizedSourcePath)
        let dbMangas = try manga.listBySource(normalizedSourcePath)
        let dbPathSet = Set(dbMangas.map(\.folderPath))
        let authorsRootPath = AuthorsLayout.resolveAuthorsPath(for: normalizedSourcePath)
        let unsortedRootPath = AuthorsLayout.resolveUnsortedPath(for: normalizedSourcePath)

        async let authorsEntries = discoverRoot(authorsRootPath, authorsRootPath: authorsRootPath)
        async let unsortedEntries = discoverRoot(unsortedRootPath, authorsRootPath: nil)
        guard let authors = try await authorsEntries, let unsorted = try await unsortedEntries else {
            return
        }
        guard FileSystem.isDirectory(normalizedSourcePath) else { return }

        let discoveredEntries = (authors + unsorted).sorted { $0.folderPath < $1.folderPath }
        let fsPathSet = Set(discoveredEntries.map(\.folderPath))

        let batchSize = 100
        var batchStart = 0
        while batchStart < discoveredEntries.count {
            try Task.checkCancellation()
            let batchEnd = min(batchStart + batchSize, discoveredEntries.count)
            let batch = discoveredEntries[batchStart..<batchEnd].map { entry in
                UpsertMangaInput(
                    title: PathUtils.displayName(for: entry.folderPath),
                    folderPath: entry.folderPath,
                    sourceFolderPath: normalizedSourcePath,
                    structure: entry.inspection.structure,
                    totalPages: entry.inspection.totalPages
                )
            }
            try manga.upsertMany(batch)
            batchStart = batchEnd
            let lastName = discoveredEntries[batchEnd - 1].folderPath
            progress?(ScanProgressPayload(
                current: sourceCurrent, total: sourceTotal,
                message: "正在扫描 \(sourceName)",
                sourceCurrent: sourceCurrent, sourceTotal: sourceTotal,
                sourceName: sourceName,
                itemCurrent: batchEnd, itemTotal: discoveredEntries.count,
                currentItemName: PathUtils.displayName(for: lastName)
            ))
            await Task.yield()
        }

        guard FileSystem.isDirectory(normalizedSourcePath) else { return }
        let stalePaths = dbPathSet.subtracting(fsPathSet)
        if !stalePaths.isEmpty {
            try manga.deleteByFolderPaths(Array(stalePaths), sourceRoot: normalizedSourcePath)
            for stalePath in stalePaths {
                await coverResolver.invalidate(stalePath)
            }
        }
    }

    public func syncImportedDirectories(
        sourcePath: String,
        directoryPaths: [String],
        progress: (@Sendable (ScanProgressPayload) -> Void)? = nil
    ) async throws {
        let normalizedSourcePath = PathUtils.normalize(sourcePath)
        let targets = Array(Set(directoryPaths.map(PathUtils.normalize).filter { !$0.isEmpty }))
        guard !targets.isEmpty else {
            progress?(ScanProgressPayload(message: "没有需要扫描的导入目录"))
            return
        }

        let dbMangas = try manga.listBySource(normalizedSourcePath)
        let existingTargetMangas = dbMangas.filter { book in
            targets.contains { PathUtils.isInside(book.folderPath, $0) }
        }
        let existingTargetPathSet = Set(existingTargetMangas.map(\.folderPath))
        var discoveredEntries: [MangaEntry] = []

        for (index, directoryPath) in targets.enumerated() {
            try Task.checkCancellation()
            progress?(ScanProgressPayload(
                current: index + 1, total: targets.count,
                message: "正在扫描导入目录 \(PathUtils.displayName(for: directoryPath))",
                sourceCurrent: index + 1, sourceTotal: targets.count,
                sourceName: PathUtils.displayName(for: directoryPath)
            ))
            guard FileSystem.isDirectory(directoryPath) else { continue }
            discoveredEntries.append(contentsOf: try await discoverMangaEntries(
                rootPath: directoryPath,
                authorsRootPath: nil,
                treatRootAsContainer: false
            ))
        }

        let discoveredPathSet = Set(discoveredEntries.map(\.folderPath))
        let batchSize = 100
        var batchStart = 0
        while batchStart < discoveredEntries.count {
            try Task.checkCancellation()
            let batchEnd = min(batchStart + batchSize, discoveredEntries.count)
            let batch = discoveredEntries[batchStart..<batchEnd].map { entry in
                UpsertMangaInput(
                    title: PathUtils.displayName(for: entry.folderPath),
                    folderPath: entry.folderPath,
                    sourceFolderPath: normalizedSourcePath,
                    structure: entry.inspection.structure,
                    totalPages: entry.inspection.totalPages
                )
            }
            try manga.upsertMany(batch)
            batchStart = batchEnd
            let lastName = discoveredEntries[batchEnd - 1].folderPath
            progress?(ScanProgressPayload(
                current: targets.count, total: targets.count,
                message: "正在更新导入的漫画",
                sourceCurrent: targets.count, sourceTotal: targets.count,
                sourceName: "Imported",
                itemCurrent: batchEnd, itemTotal: discoveredEntries.count,
                currentItemName: PathUtils.displayName(for: lastName)
            ))
            await Task.yield()
        }

        let stalePaths = existingTargetPathSet.subtracting(discoveredPathSet)
        if !stalePaths.isEmpty {
            try manga.deleteByFolderPaths(Array(stalePaths), sourceRoot: normalizedSourcePath)
            for stalePath in stalePaths {
                await coverResolver.invalidate(stalePath)
            }
        }
    }

    private func discoverRoot(_ rootPath: String, authorsRootPath: String?) async throws -> [MangaEntry]? {
        guard FileSystem.isDirectory(rootPath) else { return [] }
        do {
            return try await discoverMangaEntries(rootPath: rootPath, authorsRootPath: authorsRootPath)
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            if FileSystem.isIgnorableReadError(error) { return nil }
            throw error
        }
    }

    private func discoverMangaEntries(
        rootPath: String,
        authorsRootPath: String?,
        treatRootAsContainer: Bool = true
    ) async throws -> [MangaEntry] {
        var discovered: [MangaEntry] = []
        var stack: [String] = [PathUtils.normalize(rootPath)]
        var inspectedDirectoryCount = 0

        while let currentPath = stack.popLast() {
            try Task.checkCancellation()
            inspectedDirectoryCount += 1
            if inspectedDirectoryCount % 25 == 0 {
                await Task.yield()
            }

            var isDirectory: ObjCBool = false
            guard FileManager.default.fileExists(atPath: currentPath, isDirectory: &isDirectory), isDirectory.boolValue else {
                continue
            }

            let relativePath = PathUtils.relativePath(from: rootPath, to: currentPath)
            let relativeSegments = (relativePath ?? "").split(separator: "/").map(String.init)

            let withinAuthorsRoot = authorsRootPath.map { PathUtils.isInside(currentPath, $0) } ?? false
            let authorsRelativeSegments: [String]
            if withinAuthorsRoot, let authorsRootPath {
                authorsRelativeSegments = (PathUtils.relativePath(from: authorsRootPath, to: currentPath) ?? "")
                    .split(separator: "/").map(String.init)
            } else {
                authorsRelativeSegments = []
            }

            let shouldSkipAsContainer =
                (relativeSegments.isEmpty && treatRootAsContainer) ||
                (withinAuthorsRoot && authorsRelativeSegments.count <= 1)

            let allowChildDirectoriesAsMultiVolume = withinAuthorsRoot && authorsRelativeSegments.count >= 2

            if !shouldSkipAsContainer {
                if let inspection = try await inspectFolderAsManga(
                    currentPath,
                    allowChildDirectories: allowChildDirectoriesAsMultiVolume
                ) {
                    discovered.append(MangaEntry(folderPath: currentPath, inspection: inspection))
                    continue
                }
            }

            let childDirectories: [String]
            do {
                childDirectories = try FileSystem.listDirectories(currentPath)
            } catch {
                if FileSystem.isIgnorableReadError(error) { continue }
                throw error
            }

            for child in childDirectories.reversed() {
                try Task.checkCancellation()
                if MetadataDirectory.isMetadataDirectory(child) { continue }
                stack.append(PathUtils.normalize(child))
            }
        }

        var dedup: [String: MangaEntry] = [:]
        for entry in discovered {
            dedup[entry.folderPath] = entry
        }
        return dedup.values.sorted { $0.folderPath < $1.folderPath }
    }

    func inspectFolderAsManga(_ folderPath: String, allowChildDirectories: Bool = true) async throws -> FolderInspection? {
        try Task.checkCancellation()
        let directImages = try listImageFiles(folderPath)
        if directImages.count >= Self.minimumMangaImageCount {
            return FolderInspection(structure: .singleVolume, totalPages: directImages.count)
        }
        guard allowChildDirectories else { return nil }

        let childDirectories: [String]
        do {
            childDirectories = try FileSystem.listDirectories(folderPath)
        } catch {
            if FileSystem.isIgnorableReadError(error) { return nil }
            throw error
        }

        var totalChildPages = 0
        var hasChildVolume = false
        var childVolumeCount = 0

        for (index, childDirectory) in childDirectories.enumerated() {
            try Task.checkCancellation()
            if index > 0, index % 25 == 0 { await Task.yield() }
            let childImages = try listImageFiles(childDirectory)
            guard !childImages.isEmpty else { continue }
            hasChildVolume = true
            childVolumeCount += 1
            totalChildPages += childImages.count
        }

        // A container with exactly one real volume is usually just a parent folder:
        // let the recursion descend so the child's name is used instead.
        if childVolumeCount == 1 { return nil }
        if hasChildVolume {
            return FolderInspection(structure: .multiVolume, totalPages: totalChildPages)
        }
        return nil
    }

    private func listImageFiles(_ directoryPath: String) throws -> [String] {
        do {
            return try FileSystem.listImageFiles(directoryPath)
        } catch {
            if FileSystem.isIgnorableReadError(error) { return [] }
            throw error
        }
    }
}
