public struct UpsertMangaInput: Sendable {
    public var title: String
    public var folderPath: String
    public var sourceFolderPath: String
    public var structure: MangaStructure
    public var totalPages: Int

    public init(title: String, folderPath: String, sourceFolderPath: String, structure: MangaStructure, totalPages: Int) {
        self.title = title
        self.folderPath = folderPath
        self.sourceFolderPath = sourceFolderPath
        self.structure = structure
        self.totalPages = totalPages
    }
}
