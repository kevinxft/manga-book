import AppKit
import Foundation
import MangaBookCore
import Observation
import UserNotifications

public enum DownloadState: Sendable, Equatable {
    case fetching
    case downloading(progress: Double)
    case completed
    case failed(String)
}

@Observable
public final class DownloadTaskItem: Identifiable, @unchecked Sendable {
    public let id: String // gallery ID
    public var title: String
    public var artist: String?
    public var tags: [String] = []
    public var totalPages: Int = 0
    public var completedPages: Int = 0
    public var statusText: String = "正在解析元数据…"
    public var state: DownloadState = .fetching
    public var folderPath: String?
    public var startedAt: Date = Date()
    public var isCancelled: Bool = false

    var downloadTask: Task<Void, Never>?

    public var progressValue: Double {
        switch state {
        case .fetching:
            return 0.05
        case .downloading(let p):
            return p
        case .completed:
            return 1.0
        case .failed:
            return 0.0
        }
    }

    public init(id: String, title: String = "正在获取画册信息…", artist: String? = nil) {
        self.id = id
        self.title = title
        self.artist = artist
    }
}

@Observable
public final class DownloadManager: @unchecked Sendable {
    public static let shared = DownloadManager()

    private let lock = NSLock()
    private var _tasks: [DownloadTaskItem] = []

    public var tasks: [DownloadTaskItem] {
        get {
            lock.withLock { _tasks }
        }
        set {
            lock.withLock { _tasks = newValue }
        }
    }

    public var showDownloadCenter: Bool = false
    public var showManualInputSheet: Bool = false

    public var activeCount: Int {
        tasks.filter {
            switch $0.state {
            case .fetching, .downloading:
                return true
            case .completed, .failed:
                return false
            }
        }.count
    }

    public var isDownloading: Bool {
        activeCount > 0
    }

    public init() {
        requestNotificationPermission()
    }

    private func requestNotificationPermission() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
    }

    public func task(for id: String) -> DownloadTaskItem? {
        lock.withLock {
            _tasks.first(where: { $0.id == id })
        }
    }

    @discardableResult
    public func startDownload(
        urlOrId: String,
        libraryRoot: String,
        preferArtistFolder: Bool = true,
        onCompleted: (@Sendable (String, [String]) async -> Void)? = nil
    ) -> DownloadTaskItem? {
        guard let galleryId = HitomiDownloader.extractGalleryId(from: urlOrId) else {
            return nil
        }

        let item: DownloadTaskItem
        let existing = task(for: galleryId)
        if let existing {
            switch existing.state {
            case .fetching, .downloading:
                return existing
            case .completed, .failed:
                lock.withLock {
                    _tasks.removeAll(where: { $0.id == galleryId })
                }
            }
        }

        item = DownloadTaskItem(id: galleryId)
        lock.withLock {
            _tasks.insert(item, at: 0)
        }

        item.downloadTask = Task.detached(priority: .userInitiated) { [weak self, weak item] in
            guard let self, let item else { return }
            do {
                item.state = .fetching
                item.statusText = "正在获取画册元数据…"

                let gallery = try await HitomiDownloader.fetchMetadata(galleryId: galleryId)
                item.title = gallery.title
                item.artist = gallery.artistDisplay
                item.tags = gallery.tags
                item.totalPages = gallery.files.count

                item.statusText = "开始下载图片 (共 \(gallery.files.count) 页)…"
                item.state = .downloading(progress: 0.05)

                let result = try await HitomiDownloader.downloadGallery(
                    gallery: gallery,
                    libraryRoot: libraryRoot,
                    preferArtistFolder: preferArtistFolder
                ) { [weak item] current, total, message in
                    guard let item, !item.isCancelled else { return }
                    item.completedPages = current
                    let p = total > 0 ? Double(current) / Double(total) : 0
                    item.state = .downloading(progress: max(0.05, p))
                    item.statusText = message
                }

                guard !item.isCancelled else { return }

                item.folderPath = result.folderPath
                item.state = .completed
                item.statusText = "下载完成！共 \(result.count) 页"

                // Send local macOS notification
                self.sendNotification(
                    title: "《\(gallery.title)》下载完成",
                    body: "已保存至 \(gallery.artistDisplay) 目录，共 \(result.count) 页"
                )

                // Callback to notify AppModel to sync and insert tags
                if let onCompleted {
                    await onCompleted(result.folderPath, gallery.tags)
                }
            } catch {
                if !item.isCancelled {
                    item.state = .failed(error.localizedDescription)
                    item.statusText = "下载失败: \(error.localizedDescription)"
                }
            }
        }

        return item
    }

    public func cancel(taskId: String) {
        guard let item = task(for: taskId) else { return }
        item.isCancelled = true
        item.downloadTask?.cancel()
        item.state = .failed("已取消")
        item.statusText = "用户已取消下载"
    }

    public func remove(taskId: String) {
        cancel(taskId: taskId)
        lock.withLock {
            _tasks.removeAll(where: { $0.id == taskId })
        }
    }

    public func clearCompleted() {
        lock.withLock {
            _tasks.removeAll {
                switch $0.state {
                case .completed, .failed:
                    return true
                case .fetching, .downloading:
                    return false
                }
            }
        }
    }

    public func serializedTasks() -> [[String: Any]] {
        lock.withLock {
            _tasks.map { serializeItem($0) }
        }
    }

    public func serializedTask(id: String) -> [String: Any]? {
        lock.withLock {
            _tasks.first(where: { $0.id == id }).map { serializeItem($0) }
        }
    }

    private func serializeItem(_ item: DownloadTaskItem) -> [String: Any] {
        var stateStr = "fetching"
        switch item.state {
        case .fetching:
            stateStr = "fetching"
        case .downloading:
            stateStr = "downloading"
        case .completed:
            stateStr = "completed"
        case .failed(let err):
            return [
                "id": item.id,
                "title": item.title,
                "artist": item.artist ?? "",
                "state": "failed",
                "error": err,
                "progress": 0.0,
                "statusText": item.statusText
            ]
        }
        return [
            "id": item.id,
            "title": item.title,
            "artist": item.artist ?? "",
            "tags": item.tags,
            "totalPages": item.totalPages,
            "completedPages": item.completedPages,
            "state": stateStr,
            "progress": item.progressValue,
            "statusText": item.statusText,
            "folderPath": item.folderPath ?? ""
        ]
    }

    private func sendNotification(title: String, body: String) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        let request = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request)
    }
}
