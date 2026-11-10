import Foundation
import MangaBookCore
import Observation
import UserNotifications

@Observable
public final class DownloadManager: @unchecked Sendable {
    public static let shared = DownloadManager()

    private let lock = NSLock()
    private var _tasks: [DownloadTaskItem] = []

    public var tasks: [DownloadTaskItem] {
        lock.withLock { _tasks }
    }

    public var showDownloadCenter = false
    public var showManualInputSheet = false

    public var activeCount: Int {
        tasks.filter {
            switch $0.state {
            case .fetching, .downloading:
                true
            case .completed, .failed:
                false
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

        let item = DownloadTaskItem(id: galleryId)
        lock.withLock {
            _tasks.insert(item, at: 0)
        }

        item.downloadTask = Task.detached(priority: .userInitiated) { [weak self, weak item] in
            guard let self, let item else { return }
            do {
                item.state = .fetching
                item.statusText = "下载中…"

                let gallery = try await HitomiDownloader.fetchMetadata(galleryId: galleryId)
                item.title = gallery.title
                item.artist = gallery.artistDisplay
                item.tags = gallery.tags
                item.totalPages = gallery.files.count

                item.statusText = "下载中 (0/\(gallery.files.count) 页 · 0%)"
                item.state = .downloading(progress: 0)

                let result = try await HitomiDownloader.downloadGallery(
                    gallery: gallery,
                    libraryRoot: libraryRoot,
                    preferArtistFolder: preferArtistFolder
                ) { [weak item] current, total, _ in
                    guard let item, !item.isCancelled else { return }
                    item.completedPages = current
                    let progress = total > 0 ? Double(current) / Double(total) : 0
                    item.state = .downloading(progress: progress)
                    item.statusText = "下载中 (\(current)/\(total) 页 · \(Int((progress * 100).rounded()))%)"
                }

                guard !item.isCancelled else { return }

                item.folderPath = result.folderPath
                item.completedPages = result.count
                item.state = .completed
                item.statusText = "下载完成！共 \(result.count) 页"

                sendNotification(
                    title: "《\(gallery.title)》下载完成",
                    body: "已保存至 \(gallery.artistDisplay) 目录，共 \(result.count) 页"
                )

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
                    true
                case .fetching, .downloading:
                    false
                }
            }
        }
    }

    func serializedTasks() -> [DownloadTaskPayload] {
        lock.withLock {
            _tasks.map(serializeItem)
        }
    }

    func serializedTask(id: String) -> DownloadTaskPayload? {
        lock.withLock {
            _tasks.first(where: { $0.id == id }).map(serializeItem)
        }
    }

    private func serializeItem(_ item: DownloadTaskItem) -> DownloadTaskPayload {
        switch item.state {
        case .fetching:
            return DownloadTaskPayload(
                id: item.id,
                title: item.title,
                artist: item.artist ?? "",
                tags: item.tags,
                totalPages: item.totalPages,
                completedPages: item.completedPages,
                state: "fetching",
                progress: item.progressValue,
                statusText: item.statusText,
                folderPath: item.folderPath ?? ""
            )
        case .downloading:
            return DownloadTaskPayload(
                id: item.id,
                title: item.title,
                artist: item.artist ?? "",
                tags: item.tags,
                totalPages: item.totalPages,
                completedPages: item.completedPages,
                state: "downloading",
                progress: item.progressValue,
                statusText: item.statusText,
                folderPath: item.folderPath ?? ""
            )
        case .completed:
            return DownloadTaskPayload(
                id: item.id,
                title: item.title,
                artist: item.artist ?? "",
                tags: item.tags,
                totalPages: item.totalPages,
                completedPages: item.completedPages,
                state: "completed",
                progress: 1,
                statusText: item.statusText,
                folderPath: item.folderPath ?? ""
            )
        case .failed(let error):
            return DownloadTaskPayload(
                id: item.id,
                title: item.title,
                artist: item.artist ?? "",
                state: "failed",
                progress: 0,
                statusText: item.statusText,
                error: error
            )
        }
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
