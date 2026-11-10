import Foundation

public enum MangaStructure: String, Codable, Sendable {
    case singleVolume
    case multiVolume
}

public struct MangaBook: Identifiable, Hashable, Sendable {
    public var id: String
    public var title: String
    public var folderPath: String
    public var sourceFolderPath: String
    public var structure: MangaStructure
    public var addedAt: String
    public var lastReadAt: String?
    public var isFavorite: Bool
    public var lastChapterIndex: Int
    public var lastPageIndex: Int
    public var totalPages: Int

    public init(
        id: String,
        title: String,
        folderPath: String,
        sourceFolderPath: String,
        structure: MangaStructure,
        addedAt: String,
        lastReadAt: String?,
        isFavorite: Bool,
        lastChapterIndex: Int,
        lastPageIndex: Int,
        totalPages: Int
    ) {
        self.id = id
        self.title = title
        self.folderPath = folderPath
        self.sourceFolderPath = sourceFolderPath
        self.structure = structure
        self.addedAt = addedAt
        self.lastReadAt = lastReadAt
        self.isFavorite = isFavorite
        self.lastChapterIndex = lastChapterIndex
        self.lastPageIndex = lastPageIndex
        self.totalPages = totalPages
    }

    public var progress: Double {
        guard totalPages > 0 else { return 0 }
        return min(1, max(0, Double(lastPageIndex + 1) / Double(totalPages)))
    }

    public var folderURL: URL { URL(fileURLWithPath: folderPath, isDirectory: true) }
}
