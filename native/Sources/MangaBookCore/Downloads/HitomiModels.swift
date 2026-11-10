public struct HitomiFile: Sendable, Codable {
    public let name: String
    public let hash: String
    public let width: Int?
    public let height: Int?
    public let haswebp: Int?
    public let hasavif: Int?

    public init(name: String, hash: String, width: Int? = nil, height: Int? = nil, haswebp: Int? = nil, hasavif: Int? = nil) {
        self.name = name
        self.hash = hash
        self.width = width
        self.height = height
        self.haswebp = haswebp
        self.hasavif = hasavif
    }
}

public struct HitomiGallery: Sendable, Codable {
    public let id: String
    public let title: String
    public let japaneseTitle: String?
    public let type: String?
    public let language: String?
    public let artists: [String]
    public let tags: [String]
    public let files: [HitomiFile]

    public var artistDisplay: String {
        artists.first ?? "Unknown"
    }

    public init(
        id: String,
        title: String,
        japaneseTitle: String? = nil,
        type: String? = nil,
        language: String? = nil,
        artists: [String] = [],
        tags: [String] = [],
        files: [HitomiFile] = []
    ) {
        self.id = id
        self.title = title
        self.japaneseTitle = japaneseTitle
        self.type = type
        self.language = language
        self.artists = artists
        self.tags = tags
        self.files = files
    }
}
