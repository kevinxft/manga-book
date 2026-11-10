import CoreGraphics
import Foundation
import MangaBookCore

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
