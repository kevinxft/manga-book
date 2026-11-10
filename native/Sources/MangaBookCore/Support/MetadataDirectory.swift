import Foundation

public enum MetadataDirectory {
    public static let name = ".mangabook"
    public static let databaseFileName = "metadata.db"

    public static func isMetadataDirectory(_ path: String) -> Bool {
        (path as NSString).lastPathComponent == name
    }
}
