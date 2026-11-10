import SwiftUI

struct PageImageView: View {
    let path: String
    let maxPixelSize: Int

    @State private var displayImage: CGImage?
    @State private var failed = false

    init(path: String, maxPixelSize: Int) {
        self.path = path
        self.maxPixelSize = maxPixelSize
        _displayImage = State(initialValue: PageImageCache.shared.cachedImage(for: path, maxPixelSize: maxPixelSize))
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
        .task(id: CacheKey(path: path, maxPixelSize: maxPixelSize)) {
            if let cached = PageImageCache.shared.cachedImage(for: path, maxPixelSize: maxPixelSize) {
                displayImage = cached
                failed = false
                return
            }

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

private struct CacheKey: Hashable {
    let path: String
    let maxPixelSize: Int
}
