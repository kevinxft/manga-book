public struct LibraryFolder: Identifiable, Hashable, Sendable {
    public var id: String
    public var path: String
    public var displayName: String
    public var addedAt: String
    public var isTarget: Bool
}

public struct LibraryRoot: Hashable, Sendable {
    public var path: String
    public var displayName: String
    public var initializedAt: String
    public var hasCustomIcon: Bool
}

public struct TargetDirectorySummary: Identifiable, Hashable, Sendable {
    public var id: String { directory }
    public var directory: String
    public var mangaCount: Int
    public var lastMovedAt: String?
}
