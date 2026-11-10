import Foundation

public actor CoverResolver {
    private struct Entry {
        var coverPath: String?
        var updatedAt: Date
    }

    private var cache: [String: Entry] = [:]
    private let ttl: TimeInterval = 5 * 60

    public init() {}

    public func resolveCoverPath(for folderPath: String) -> String? {
        let key = PathUtils.normalize(folderPath)
        if let cached = cache[key], Date.now.timeIntervalSince(cached.updatedAt) < ttl {
            return cached.coverPath
        }

        var coverPath = findCover(in: key)
        if coverPath == nil {
            let subDirectories = ((try? FileSystem.listDirectories(key)) ?? [])
                .sorted { $0.localizedStandardCompare($1) == .orderedAscending }
            for subDirectory in subDirectories {
                if let found = findCover(in: subDirectory) {
                    coverPath = found
                    break
                }
            }
        }

        cache[key] = Entry(coverPath: coverPath, updatedAt: .now)
        return coverPath
    }

    public func invalidate(_ folderPath: String) {
        cache.removeValue(forKey: PathUtils.normalize(folderPath))
    }

    public func clear() {
        cache.removeAll()
    }

    private func findCover(in directoryPath: String) -> String? {
        guard let files = try? FileSystem.listFiles(directoryPath) else { return nil }
        return files
            .sorted { $0.localizedStandardCompare($1) == .orderedAscending }
            .first { ImageFiles.isSupported($0) }
    }
}
