import SwiftUI

struct MenuBarIconView: View {
    private var manager: DownloadManager { DownloadManager.shared }

    var body: some View {
        HStack(spacing: 3) {
            Image(systemName: manager.isDownloading ? "arrow.down.circle.fill" : "books.vertical.fill")
            if manager.activeCount > 0 {
                Text("\(manager.activeCount)")
                    .font(.system(size: 10, weight: .bold, design: .monospaced))
            }
        }
    }
}
