import Observation

@Observable
public final class DownloadTaskItem: Identifiable, @unchecked Sendable {
    public let id: String
    public var title: String
    public var artist: String?
    public var tags: [String] = []
    public var totalPages = 0
    public var completedPages = 0
    public var statusText = "下载中…"
    public var state: DownloadState = .fetching
    public var folderPath: String?
    public var isCancelled = false

    var downloadTask: Task<Void, Never>?

    public var progressValue: Double {
        switch state {
        case .fetching:
            0
        case .downloading(let progress):
            progress
        case .completed:
            1
        case .failed:
            0
        }
    }

    public init(id: String, title: String = "下载中…", artist: String? = nil) {
        self.id = id
        self.title = title
        self.artist = artist
    }
}
