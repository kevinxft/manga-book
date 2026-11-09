import AppKit
import MangaBookCore
import SwiftUI

actor PageImageCache {
    static let shared = PageImageCache()

    private let cache = NSCache<NSString, CGImage>()
    private var inFlight: [String: Task<CGImage?, Never>] = [:]

    init() {
        cache.countLimit = 18
        cache.totalCostLimit = 420 * 1024 * 1024
    }

    func image(for path: String, maxPixelSize: Int) async -> CGImage? {
        let key = "\(path)|\(maxPixelSize)"
        if let cached = cache.object(forKey: key as NSString) {
            return cached
        }
        if let running = inFlight[key] {
            return await running.value
        }

        let task = Task.detached(priority: .userInitiated) {
            ImageDecoder.downsample(path: path, maxPixelSize: maxPixelSize)
        }
        inFlight[key] = task
        let image = await task.value
        inFlight[key] = nil
        if let image {
            cache.setObject(image, forKey: key as NSString, cost: image.bytesPerRow * image.height)
        }
        return image
    }

    func clear() {
        cache.removeAllObjects()
    }
}

struct PageImageView: View {
    let path: String
    let maxPixelSize: Int

    @State private var image: CGImage?
    @State private var failed = false

    var body: some View {
        Group {
            if let image {
                Image(decorative: image, scale: 1, orientation: .up)
                    .resizable()
                    .interpolation(.high)
                    .scaledToFit()
            } else {
                ZStack {
                    Rectangle().fill(Color.white.opacity(0.035))
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
            image = nil
            failed = false
            image = await PageImageCache.shared.image(for: path, maxPixelSize: maxPixelSize)
            failed = image == nil
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
