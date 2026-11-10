import Foundation

public enum PathUtils {
    /// Lexical normalization matching Node's `path.resolve` + `path.normalize`.
    public static func normalize(_ input: String) -> String {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return trimmed }
        let expanded = (trimmed as NSString).expandingTildeInPath
        let url = URL(fileURLWithPath: expanded).standardizedFileURL
        return url.path
    }

    public static func displayName(for path: String) -> String {
        (normalize(path) as NSString).lastPathComponent
    }

    public static func isInside(_ targetPath: String, _ parentPath: String) -> Bool {
        let target = normalize(targetPath)
        let parent = normalize(parentPath)
        return target == parent || target.hasPrefix(parent + "/")
    }

    public static func relativePath(from root: String, to target: String) -> String? {
        let rootPath = normalize(root)
        let targetPath = normalize(target)
        guard isInside(targetPath, rootPath), targetPath != rootPath else { return nil }
        var relative = String(targetPath.dropFirst(rootPath.count))
        while relative.hasPrefix("/") { relative.removeFirst() }
        while relative.hasSuffix("/") { relative.removeLast() }
        return relative
    }

    public static func join(_ root: String, _ relative: String) -> String {
        normalize((root as NSString).appendingPathComponent(relative))
    }

    public static func key(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    public static func sanitizePathComponent(_ name: String) -> String {
        let invalidChars = CharacterSet(charactersIn: "/\\?%*|\":<>")
        let sanitized = name.components(separatedBy: invalidChars).joined(separator: "_")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return sanitized.isEmpty ? "Untitled" : sanitized
    }
}

public enum AppPaths {
    public static var applicationSupport: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    }

    public static var appSupportDirectory: URL {
        applicationSupport.appendingPathComponent("MangaBook", isDirectory: true)
    }

    public static var legacyDatabaseURL: URL {
        legacyDatabaseURL(in: appSupportDirectory)
    }

    public static func legacyDatabaseURL(in base: URL) -> URL {
        base.appendingPathComponent("mangabook.db")
    }

    public static var sourceMetadataRoot: URL {
        sourceMetadataRoot(in: appSupportDirectory)
    }

    public static func sourceMetadataRoot(in base: URL) -> URL {
        base.appendingPathComponent("source-metadata", isDirectory: true)
    }

    public static var cachesDirectory: URL {
        let base = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        return base.appendingPathComponent("MangaBook", isDirectory: true)
    }

    public static func sourceMetadataDirectory(for rootPath: String, in base: URL = appSupportDirectory) -> URL {
        let normalized = PathUtils.normalize(rootPath)
        let hash = SHA1.hex(normalized)
        return sourceMetadataRoot(in: base).appendingPathComponent(hash, isDirectory: true)
    }

    public static func sourceMetadataDatabaseURL(for rootPath: String, in base: URL = appSupportDirectory) -> URL {
        sourceMetadataDirectory(for: rootPath, in: base).appendingPathComponent("metadata.db")
    }
}

import CryptoKit

public enum SHA1 {
    public static func hex(_ value: String) -> String {
        let digest = Insecure.SHA1.hash(data: Data(value.utf8))
        return digest.map { String(format: "%02x", $0) }.joined()
    }
}
