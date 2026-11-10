public enum MangaSort: String, CaseIterable, Sendable {
    case addedAtDesc
    case addedAtAsc
    case titleAsc
    case titleDesc
    case lastReadAtDesc

    public var label: String {
        switch self {
        case .addedAtDesc: return "添加时间（新→旧）"
        case .addedAtAsc: return "添加时间（旧→新）"
        case .titleAsc: return "名称（A→Z）"
        case .titleDesc: return "名称（Z→A）"
        case .lastReadAtDesc: return "最近阅读"
        }
    }
}

public struct MangaFilter: Sendable {
    public var query: String?
    public var sort: MangaSort
    public var sourceFolderPaths: [String]

    public init(query: String? = nil, sort: MangaSort = .addedAtDesc, sourceFolderPaths: [String] = []) {
        self.query = query
        self.sort = sort
        self.sourceFolderPaths = sourceFolderPaths
    }
}
