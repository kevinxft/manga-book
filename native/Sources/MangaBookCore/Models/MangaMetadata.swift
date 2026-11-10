public struct MangaTag: Identifiable, Hashable, Sendable {
    public var id: String
    public var name: String
    public var createdAt: String

    public init(id: String, name: String, createdAt: String) {
        self.id = id
        self.name = name
        self.createdAt = createdAt
    }
}

public struct Bookmark: Identifiable, Hashable, Sendable {
    public var id: String
    public var mangaId: String
    public var chapterIndex: Int
    public var pageIndex: Int
    public var chapterName: String
    public var title: String
    public var note: String
    public var createdAt: String
}

public struct DirectoryAlias: Identifiable, Hashable, Sendable {
    public var id: String
    public var alias: String
    public var canonicalName: String
    public var createdAt: String
}
