import Foundation

public enum FileSystem {
    public static func isDirectory(_ path: String) -> Bool {
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: path, isDirectory: &isDirectory) else { return false }
        return isDirectory.boolValue
    }

    public static func exists(_ path: String) -> Bool {
        FileManager.default.fileExists(atPath: path)
    }

    public static func listDirectories(_ path: String) throws -> [String] {
        let entries = try FileManager.default.contentsOfDirectory(atPath: path)
        return entries.compactMap { name in
            let fullPath = (path as NSString).appendingPathComponent(name)
            return isDirectory(fullPath) ? PathUtils.normalize(fullPath) : nil
        }
    }

    public static func listFiles(_ path: String) throws -> [String] {
        let entries = try FileManager.default.contentsOfDirectory(atPath: path)
        return entries.compactMap { name in
            let fullPath = (path as NSString).appendingPathComponent(name)
            var isDirectory: ObjCBool = false
            guard FileManager.default.fileExists(atPath: fullPath, isDirectory: &isDirectory), !isDirectory.boolValue else {
                return nil
            }
            return fullPath
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
