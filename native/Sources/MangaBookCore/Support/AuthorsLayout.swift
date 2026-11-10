import Foundation

public enum AuthorsLayout {
    public static let authorsName = "Authors"
    public static let unsortedName = "Unsorted"

    public static func authorsPath(for root: String) -> String {
        PathUtils.normalize((root as NSString).appendingPathComponent(authorsName))
    }

    public static func unsortedPath(for root: String) -> String {
        PathUtils.normalize((root as NSString).appendingPathComponent(unsortedName))
    }

    /// Case-insensitive lookup of the real Authors / Unsorted directory on disk.
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
