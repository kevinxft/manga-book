import AppKit
import MangaBookCore
import SwiftUI

struct DownloadTaskRow: View {
    @Environment(AppModel.self) private var model
    let task: DownloadTaskItem

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .top, spacing: 8) {
                ZStack {
                    RoundedRectangle(cornerRadius: 6)
                        .fill(stateColor.opacity(0.12))
                        .frame(width: 32, height: 32)
                    Image(systemName: stateIcon)
                        .foregroundStyle(stateColor)
                        .font(.system(size: 14))
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(task.title)
                        .font(.subheadline.weight(.semibold))
                        .lineLimit(1)

                    HStack(spacing: 6) {
                        if let artist = task.artist, !artist.isEmpty {
                            Text(artist)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        if task.totalPages > 0 {
                            Text("• \(task.completedPages)/\(task.totalPages) 页")
                                .font(.caption.monospacedDigit())
                                .foregroundStyle(.tertiary)
                        }
                    }
                }

                Spacer()

                actionButtons
            }

            switch task.state {
            case .fetching:
                ProgressView()
                    .controlSize(.small)
            case .downloading(let progress):
                VStack(alignment: .trailing, spacing: 2) {
                    ProgressView(value: progress)
                        .progressViewStyle(.linear)
                    Text(task.statusText)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            case .completed:
                HStack {
                    Text(task.statusText)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    Spacer()
                    Text("完成")
                        .font(.caption2.bold())
                        .foregroundStyle(.green)
                }
            case .failed(let error):
                Text(error)
                    .font(.caption2)
                    .foregroundStyle(.red)
                    .lineLimit(2)
            }
        }
        .padding(10)
        .background(Color.secondary.opacity(0.06), in: RoundedRectangle(cornerRadius: 8))
    }

    private var stateColor: Color {
        switch task.state {
        case .fetching, .downloading:
            .accentColor
        case .completed:
            .green
        case .failed:
            .red
        }
    }

    private var stateIcon: String {
        switch task.state {
        case .fetching:
            "arrow.triangle.2.circlepath"
        case .downloading:
            "arrow.down"
        case .completed:
            "checkmark"
        case .failed:
            "exclamationmark.triangle"
        }
    }

    @ViewBuilder
    private var actionButtons: some View {
        switch task.state {
        case .fetching, .downloading:
            Button {
                DownloadManager.shared.cancel(taskId: task.id)
            } label: {
                Image(systemName: "xmark.circle")
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
            .help("取消下载")

        case .completed:
            HStack(spacing: 4) {
                if let folder = task.folderPath {
                    Button {
                        NSWorkspace.shared.activateFileViewerSelecting([URL(fileURLWithPath: folder)])
                    } label: {
                        Image(systemName: "folder")
                            .font(.caption)
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                    .help("在 Finder 中显示")

                    if let book = model.allBooks.first(where: { $0.folderPath == folder }) {
                        Button("阅读") {
                            model.openReader(book)
                        }
                        .buttonStyle(.borderedProminent)
                        .controlSize(.small)
                    }
                }
            }

        case .failed:
            HStack(spacing: 4) {
                Button("重试") {
                    model.downloadHitomi(urlOrId: task.id)
                }
                .controlSize(.small)

                Button {
                    DownloadManager.shared.remove(taskId: task.id)
                } label: {
                    Image(systemName: "trash")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }
        }
    }
}
