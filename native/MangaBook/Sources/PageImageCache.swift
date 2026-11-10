import AppKit
import MangaBookCore
import SwiftUI

final class PageImageCache: @unchecked Sendable {
    static let shared = PageImageCache()

    private let cache = NSCache<NSString, CGImage>()
    private let lock = NSLock()
    private var inFlight: [String: Task<CGImage?, Never>] = [:]

    init() {
        cache.countLimit = 48
        cache.totalCostLimit = 800 * 1024 * 1024 // 800MB
    }

    /// Synchronous memory cache check - zero latency, main-thread safe!
    func cachedImage(for path: String, maxPixelSize: Int) -> CGImage? {
        let key = "\(path)|\(maxPixelSize)" as NSString
        return cache.object(forKey: key)
    }

    /// Asynchronous fetch or decode
    func image(for path: String, maxPixelSize: Int) async -> CGImage? {
        let key = "\(path)|\(maxPixelSize)"
        if let cached = cache.object(forKey: key as NSString) {
            return cached
        }

        var runningTask: Task<CGImage?, Never>?
        lock.withLock {
            if let existing = inFlight[key] {
                runningTask = existing
            } else {
                let task = Task.detached(priority: .userInitiated) {
                    ImageDecoder.downsample(path: path, maxPixelSize: maxPixelSize)
                }
                inFlight[key] = task
                runningTask = task
            }
        }

        guard let task = runningTask else { return nil }
        let image = await task.value

        lock.withLock {
            inFlight[key] = nil
            if let image {
                cache.setObject(image, forKey: key as NSString, cost: image.bytesPerRow * image.height)
            }
        }
        return image
    }

    /// Silent background preloading of upcoming pages
    func preload(paths: [String], maxPixelSize: Int) {
        for path in paths {
            let key = "\(path)|\(maxPixelSize)"
            if cache.object(forKey: key as NSString) != nil {
                continue
            }
            lock.withLock {
                if inFlight[key] != nil { return }
                let task = Task.detached(priority: .utility) {
                    ImageDecoder.downsample(path: path, maxPixelSize: maxPixelSize)
                }
                inFlight[key] = task
                Task.detached(priority: .utility) { [weak self] in
                    let img = await task.value
                    guard let self, let img else { return }
                    self.lock.withLock {
                        self.inFlight[key] = nil
                        self.cache.setObject(img, forKey: key as NSString, cost: img.bytesPerRow * img.height)
                    }
                }
            }
        }
    }

    func clear() {
        lock.withLock {
            cache.removeAllObjects()
            inFlight.removeAll()
        }
    }
}

struct PageImageView: View {
    let path: String
    let maxPixelSize: Int

    @State private var displayImage: CGImage?
    @State private var failed = false

    init(path: String, maxPixelSize: Int) {
        self.path = path
        self.maxPixelSize = maxPixelSize
        let cached = PageImageCache.shared.cachedImage(for: path, maxPixelSize: maxPixelSize)
        _displayImage = State(initialValue: cached)
    }

    var body: some View {
        ZStack {
            if let image = displayImage {
                Image(decorative: image, scale: 1, orientation: .up)
                    .resizable()
                    .interpolation(.high)
                    .scaledToFit()
            } else {
                ZStack {
                    Color.black
                    if failed {
                        VStack(spacing: 8) {
                            Image(systemName: "photo.badge.exclamationmark")
                                .font(.title2)
                            Text("无法加载页面")
                                .font(.caption)
                        }
                        .foregroundStyle(.secondary)
                    } else {
                        ProgressView().controlSize(.small)
                    }
                }
                .aspectRatio(0.7, contentMode: .fit)
            }
        }
        .task(id: path) {
            // 1. Synchronously hit memory cache if already pre-decoded
            if let cached = PageImageCache.shared.cachedImage(for: path, maxPixelSize: maxPixelSize) {
                displayImage = cached
                failed = false
                return
            }

            // 2. If not in memory yet, do NOT reset displayImage to nil!
            // Keeping previous image prevents the black/gray box flashing.
            let loaded = await PageImageCache.shared.image(for: path, maxPixelSize: maxPixelSize)
            if let loaded {
                displayImage = loaded
                failed = false
            } else if displayImage == nil {
                failed = true
            }
        }
    }
}

struct PageThumbnailView: View {
    let path: String
    var maxPixelSize: Int = 220

    @State private var image: CGImage?

    var body: some View {
        Group {
            if let image {
                Image(decorative: image, scale: 1, orientation: .up)
                    .resizable()
                    .interpolation(.medium)
                    .scaledToFill()
            } else {
                Rectangle().fill(Color.white.opacity(0.05))
                    .overlay(ProgressView().controlSize(.mini))
            }
        }
        .task(id: path) {
            image = await ThumbnailService.shared.thumbnail(forImagePath: path, maxPixelSize: maxPixelSize)
        }
    }
}
