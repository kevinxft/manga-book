public struct MoveMangaResult: Sendable {
    public var manga: MangaBook
    public var renamedDueToConflict: Bool
}

public struct MergeAuthorDirectoriesResult: Sendable {
    public var targetPath: String
    public var targetName: String
    public var movedCount: Int
    public var deletedSourcePaths: [String]
    public var renamedConflictCount: Int
    public var aliases: [DirectoryAlias]
}

public struct ImportMangasResult: Sendable {
    public var importedCount: Int
    public var renamedConflictCount: Int
    public var skipped: [(path: String, reason: String)]
    public var targetPaths: [String]
}
