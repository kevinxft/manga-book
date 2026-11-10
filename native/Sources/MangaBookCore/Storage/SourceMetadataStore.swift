import Foundation
import GRDB

public final class SourceMetadataStore: @unchecked Sendable {
    private let libraryStore: LibraryStore
    private let metadataRoot: URL
    private var cache: [String: DatabaseQueue] = [:]
    private let lock = NSLock()

    public init(libraryStore: LibraryStore, metadataRoot: URL = AppPaths.sourceMetadataRoot) {
        self.libraryStore = libraryStore
        self.metadataRoot = metadataRoot
    }

    public var activeRoot: String? {
        guard let root = try? libraryStore.root() else { return nil }
        return PathUtils.normalize(root.path)
    }

    public func registeredRoots() -> [String] {
        guard let folders = try? libraryStore.list() else { return [] }
        return folders
            .map { PathUtils.normalize($0.path) }
            .filter { FileSystem.isDirectory($0) }
    }

    public func database(for root: String) throws -> DatabaseQueue {
        let normalized = PathUtils.normalize(root)
        lock.lock()
        defer { lock.unlock() }
        if let cached = cache[normalized] {
            return cached
        }

        let directory = metadataRoot.appendingPathComponent(SHA1.hex(normalized), isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let databaseURL = directory.appendingPathComponent(MetadataDirectory.databaseFileName)
        var configuration = Configuration()
        configuration.foreignKeysEnabled = true
        let queue = try DatabaseQueue(path: databaseURL.path, configuration: configuration)
        try queue.write { db in
            try Schema.initializeSource(db)
        }
        cache[normalized] = queue
        return queue
    }

    public func existingDatabase(for root: String) -> DatabaseQueue? {
        let normalized = PathUtils.normalize(root)
        guard FileSystem.isDirectory(normalized) else { return nil }
        return try? database(for: normalized)
    }

    public func listRegisteredDatabases() -> [(root: String, queue: DatabaseQueue)] {
        registeredRoots().compactMap { root in
            guard let queue = existingDatabase(for: root) else { return nil }
            return (root, queue)
        }
    }
}
