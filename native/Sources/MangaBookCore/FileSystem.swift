import Foundation

public enum ImageFiles {
    public static let supportedExtensions: Set<String> = [
        ".avif", ".bmp", ".gif", ".heic", ".heif", ".jpeg", ".jpg", ".png", ".tif", ".tiff", ".webp"
    ]

    public static func isSupported(_ fileName: String) -> Bool {
        let ext = ("." + (fileName as NSString).pathExtension).lowercased()
        return supportedExtensions.contains(ext)
    }
}

public enum MetadataDirectory {
    public static let name = ".mangabook"
    public static let databaseFileName = "metadata.db"

    public static func isMetadataDirectory(_ path: String) -> Bool {
        (path as NSString).lastPathComponent == name
    }
}

public enum FileSystem {
    public static func isDirectory(_ path: String) -> Bool {
        var isDir: ObjCBool = false
        guard FileManager.default.fileExists(atPath: path, isDirectory: &isDir) else { return false }
        return isDir.boolValue
    }

    public static func exists(_ path: String) -> Bool {
        FileManager.default.fileExists(atPath: path)
    }

    public static func listDirectories(_ path: String) throws -> [String] {
        let entries = try FileManager.default.contentsOfDirectory(atPath: path)
        return entries.compactMap { name in
            let full = (path as NSString).appendingPathComponent(name)
            return isDirectory(full) ? PathUtils.normalize(full) : nil
        }
    }

    public static func listFiles(_ path: String) throws -> [String] {
        let entries = try FileManager.default.contentsOfDirectory(atPath: path)
        return entries.compactMap { name in
            let full = (path as NSString).appendingPathComponent(name)
            var isDir: ObjCBool = false
            guard FileManager.default.fileExists(atPath: full, isDirectory: &isDir), !isDir.boolValue else { return nil }
            return full
        }
    }

    public static func listImageFiles(_ path: String) throws -> [String] {
        try listFiles(path).filter { ImageFiles.isSupported($0) }
    }

    public static func ensureDirectory(_ path: String) throws {
        try FileManager.default.createDirectory(atPath: path, withIntermediateDirectories: true)
    }

    public static func isIgnorableReadError(_ error: Error) -> Bool {
        let nsError = error as NSError
        guard nsError.domain == NSCocoaErrorDomain else { return false }
        return nsError.code == NSFileReadNoSuchFileError
            || nsError.code == NSFileNoSuchFileError
            || nsError.code == NSFileReadUnknownError
    }

    public static func move(_ source: String, to destination: String) throws {
        try FileManager.default.moveItem(atPath: source, toPath: destination)
    }
}

public enum AuthorsLayout {
    public static let authorsName = "Authors"
    public static let unsortedName = "Unsorted"

    public static func authorsPath(for root: String) -> String {
        PathUtils.normalize((root as NSString).appendingPathComponent(authorsName))
    }

    public static func unsortedPath(for root: String) -> String {
        PathUtils.normalize((root as NSString).appendingPathComponent(unsortedName))
    }

    /// Case-insensitive lookup of the real `Authors` / `Unsorted` directory on disk.
    public static func findDirectory(named name: String, in root: String) -> String? {
        guard let children = try? FileSystem.listDirectories(root) else { return nil }
        return children
            .filter { !MetadataDirectory.isMetadataDirectory($0) }
            .first { ($0 as NSString).lastPathComponent.lowercased() == name.lowercased() }
    }

    public static func resolveAuthorsPath(for root: String) -> String {
        findDirectory(named: authorsName, in: root) ?? authorsPath(for: root)
    }

    public static func resolveUnsortedPath(for root: String) -> String {
        findDirectory(named: unsortedName, in: root) ?? unsortedPath(for: root)
    }
}
