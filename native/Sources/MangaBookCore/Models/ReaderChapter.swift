public struct ReaderChapter: Identifiable, Hashable, Sendable {
    public enum Source: String, Sendable {
        case filesystem
        case manual
        case generated
    }

    public var id: String
    public var title: String
    public var startPageIndex: Int
    public var endPageIndex: Int
    public var pageCount: Int
    public var source: Source
    public var highlighted: Bool
    public var deletable: Bool
}
