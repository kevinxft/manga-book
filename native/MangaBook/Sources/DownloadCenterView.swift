import AppKit
import SwiftUI
import MangaBookCore

struct DownloadCenterView: View {
    @Environment(AppModel.self) private var model
    private var manager: DownloadManager { DownloadManager.shared }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                HStack(spacing: 6) {
                    Image(systemName: "arrow.down.circle.fill")
                        .foregroundStyle(Color.accentColor)
                    Text("下载中心")
                        .font(.headline)
                    if manager.activeCount > 0 {
                        Text("\(manager.activeCount)")
                            .font(.caption2.bold().monospacedDigit())
                            .foregroundStyle(.white)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 1)
                            .background(Capsule().fill(Color.accentColor))
                    }
                }

                Spacer()

                Button("手动添加…", systemImage: "plus") {
                    manager.showManualInputSheet = true
                }
                .controlSize(.small)

                if manager.tasks.contains(where: {
                    if case .completed = $0.state { return true }
                    if case .failed = $0.state { return true }
                    return false
                }) {
                    Button("清空已完成") {
                        manager.clearCompleted()
                    }
                    .controlSize(.small)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(.bar)

            Divider()

            // Task List
            if manager.tasks.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "arrow.down.doc")
                        .font(.system(size: 32))
                        .foregroundStyle(.tertiary)
                    Text("暂无下载任务")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                    Text("在浏览器 Hitomi 页面点击「下载到漫书」，或点击上方「手动添加」粘贴网址")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 24)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .frame(height: 220)
            } else {
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(manager.tasks) { task in
                            DownloadTaskRow(task: task)
                                .environment(model)
                        }
                    }
                    .padding(10)
                }
                .frame(height: 340)
            }
        }
        .frame(width: 420)
        .sheet(isPresented: Bindable(manager).showManualInputSheet) {
            ManualDownloadSheet()
                .environment(model)
        }
    }
}

private struct DownloadTaskRow: View {
    @Environment(AppModel.self) private var model
    let task: DownloadTaskItem

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .top, spacing: 8) {
                // State icon
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

                // Actions
                actionButtons
            }

            // Progress bar
            switch task.state {
            case .fetching:
                ProgressView()
                    .controlSize(.small)
            case .downloading(let p):
                VStack(alignment: .trailing, spacing: 2) {
                    ProgressView(value: p)
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
            case .failed(let err):
                Text(err)
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
            return .accentColor
        case .completed:
            return .green
        case .failed:
            return .red
        }
    }

    private var stateIcon: String {
        switch task.state {
        case .fetching:
            return "arrow.triangle.2.circlepath"
        case .downloading:
            return "arrow.down"
        case .completed:
            return "checkmark"
        case .failed:
            return "exclamationmark.triangle"
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
                    if let root = model.root?.path {
                        model.downloadHitomi(urlOrId: task.id)
                    }
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

struct ManualDownloadSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    @State private var input = ""
    @State private var preferArtist = true
    @State private var errorText: String?

    var body: some View {
        VStack(spacing: 16) {
            HStack {
                Text("添加 Hitomi 下载")
                    .font(.headline)
                Spacer()
                Button {
                    dismiss()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("输入 Hitomi 网址或画册 ID")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                TextField("粘贴漫画网址或画册编号…", text: $input)
                    .textFieldStyle(.roundedBorder)

                Toggle("按作者自动创建分类目录 (Authors/作者/漫画名)", isOn: $preferArtist)
                    .font(.caption)
            }

            if let errorText {
                Text(errorText)
                    .font(.caption)
                    .foregroundStyle(.red)
            }

            HStack {
                Button("取消") { dismiss() }
                    .keyboardShortcut(.cancelAction)

                Spacer()

                Button("开始下载") {
                    let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !trimmed.isEmpty else { return }
                    if HitomiDownloader.extractGalleryId(from: trimmed) == nil {
                        errorText = "无法识别有效的 Hitomi 链接或画册 ID"
                        return
                    }
                    model.downloadHitomi(urlOrId: trimmed, preferArtistFolder: preferArtist)
                    dismiss()
                }
                .buttonStyle(.borderedProminent)
                .keyboardShortcut(.defaultAction)
            }
        }
        .padding(20)
        .frame(width: 460)
    }
}
