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
        let chapterBase = structure == .multiVolume ? 0 : lastPageIndex
        _ = chapterBase
        return min(1, max(0, Double(lastPageIndex + 1) / Double(totalPages)))
    }

    public var folderURL: URL { URL(fileURLWithPath: folderPath, isDirectory: true) }
}

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

public struct ScanProgressPayload: Sendable, Equatable {
    public var current: Int
    public var total: Int
    public var message: String
    public var sourceCurrent: Int
    public var sourceTotal: Int
    public var sourceName: String
    public var itemCurrent: Int
    public var itemTotal: Int
    public var currentItemName: String

    public init(
        current: Int = 0,
        total: Int = 0,
        message: String = "",
        sourceCurrent: Int = 0,
        sourceTotal: Int = 0,
        sourceName: String = "",
        itemCurrent: Int = 0,
        itemTotal: Int = 0,
        currentItemName: String = ""
    ) {
        self.current = current
        self.total = total
        self.message = message
        self.sourceCurrent = sourceCurrent
        self.sourceTotal = sourceTotal
        self.sourceName = sourceName
        self.itemCurrent = itemCurrent
        self.itemTotal = itemTotal
        self.currentItemName = currentItemName
    }
}
