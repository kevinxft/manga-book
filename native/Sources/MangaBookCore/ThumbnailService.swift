import Foundation
import ImageIO
import CoreGraphics
import UniformTypeIdentifiers

public actor ThumbnailService {
    public static let shared = ThumbnailService()

    private let memoryCache = NSCache<NSString, CGImage>()
    private var inFlight: [String: Task<CGImage?, Never>] = [:]
    private let diskCacheDirectory: URL

    public init() {
        let directory = AppPaths.cachesDirectory.appendingPathComponent("thumbnails", isDirectory: true)
        diskCacheDirectory = directory
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        memoryCache.countLimit = 600
        memoryCache.totalCostLimit = 160 * 1024 * 1024
    }

    public func thumbnail(forImagePath path: String, maxPixelSize: Int = 512) async -> CGImage? {
        let key = cacheKey(path: path, maxPixelSize: maxPixelSize)
        if let cached = memoryCache.object(forKey: key as NSString) {
            return cached
        }
        if let running = inFlight[key] {
            return await running.value
        }

        let task = Task<CGImage?, Never> {
            if let diskImage = Self.loadDiskImage(at: diskCacheDirectory.appendingPathComponent(key + ".jpg")) {
                return diskImage
            }
            guard let image = Self.downsample(path: path, maxPixelSize: maxPixelSize) else {
                return nil
            }
            Self.writeDiskImage(image, to: diskCacheDirectory.appendingPathComponent(key + ".jpg"))
            return image
        }
        inFlight[key] = task
        let image = await task.value
        inFlight[key] = nil
        if let image {
            let cost = image.bytesPerRow * image.height
            memoryCache.setObject(image, forKey: key as NSString, cost: cost)
        }
        return image
    }

    public func clearMemory() {
        memoryCache.removeAllObjects()
    }

    public func clearDisk() {
        try? FileManager.default.removeItem(at: diskCacheDirectory)
        try? FileManager.default.createDirectory(at: diskCacheDirectory, withIntermediateDirectories: true)
    }

    private func cacheKey(path: String, maxPixelSize: Int) -> String {
        let attributes = try? FileManager.default.attributesOfItem(atPath: path)
        let modified = (attributes?[.modificationDate] as? Date)?.timeIntervalSince1970 ?? 0
        let size = (attributes?[.size] as? NSNumber)?.intValue ?? 0
        return SHA1.hex("\(path)|\(modified)|\(size)|\(maxPixelSize)")
    }

    nonisolated private static func downsample(path: String, maxPixelSize: Int) -> CGImage? {
        let url = URL(fileURLWithPath: path)
        guard let source = CGImageSourceCreateWithURL(url as CFURL, [kCGImageSourceShouldCache: false] as CFDictionary) else {
            return nil
        }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixelSize
        ]
        return CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary)
    }

    nonisolated private static func loadDiskImage(at url: URL) -> CGImage? {
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
        return CGImageSourceCreateImageAtIndex(source, 0, nil)
    }

    nonisolated private static func writeDiskImage(_ image: CGImage, to url: URL) {
        guard let destination = CGImageDestinationCreateWithURL(
            url as CFURL,
            UTType.jpeg.identifier as CFString,
            1,
            nil
        ) else { return }
        let options: [CFString: Any] = [kCGImageDestinationLossyCompressionQuality: 0.82]
        CGImageDestinationAddImage(destination, image, options as CFDictionary)
        CGImageDestinationFinalize(destination)
    }
}

public enum ImageDecoder {
    public static func loadFullImage(path: String) -> CGImage? {
        let url = URL(fileURLWithPath: path)
        guard let source = CGImageSourceCreateWithURL(url as CFURL, [kCGImageSourceShouldCache: false] as CFDictionary) else {
            return nil
        }
        return CGImageSourceCreateImageAtIndex(source, 0, [kCGImageSourceShouldCacheImmediately: true] as CFDictionary)
    }

    public static func downsample(path: String, maxPixelSize: Int) -> CGImage? {
        let url = URL(fileURLWithPath: path)
        guard let source = CGImageSourceCreateWithURL(url as CFURL, [kCGImageSourceShouldCache: false] as CFDictionary) else {
            return nil
        }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixelSize
        ]
        return CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary)
    }
}
