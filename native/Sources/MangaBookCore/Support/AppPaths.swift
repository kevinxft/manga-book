import Foundation

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
        sourceMetadataRoot(in: base).appendingPathComponent(SHA1.hex(PathUtils.normalize(rootPath)), isDirectory: true)
    }

    public static func sourceMetadataDatabaseURL(for rootPath: String, in base: URL = appSupportDirectory) -> URL {
        sourceMetadataDirectory(for: rootPath, in: base).appendingPathComponent("metadata.db")
    }
}
