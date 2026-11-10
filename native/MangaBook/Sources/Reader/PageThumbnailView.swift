import MangaBookCore
import SwiftUI

struct PageThumbnailView: View {
    let path: String
    var maxPixelSize = 220

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
