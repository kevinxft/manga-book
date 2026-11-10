import AppKit
import SwiftUI
import MangaBookCore

struct MenuBarView: View {
    @Environment(AppModel.self) private var model
    private var manager: DownloadManager { DownloadManager.shared }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Header
            HStack {
                HStack(spacing: 6) {
                    Image(systemName: "books.vertical.fill")
                        .foregroundStyle(Color.accentColor)
                    Text("漫书")
                        .font(.headline)
                }

                Spacer()

                if manager.isDownloading {
                    HStack(spacing: 4) {
                        ProgressView()
                            .controlSize(.mini)
                        Text("下载中")
                            .font(.caption2.bold())
                            .foregroundStyle(Color.accentColor)
                    }
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Capsule().fill(Color.accentColor.opacity(0.12)))
                } else {
                    Text("就绪")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }

            Divider()

            // Download status
            if let active = manager.tasks.first(where: {
                if case .downloading = $0.state { return true }
                if case .fetching = $0.state { return true }
                return false
            }) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(active.title)
                        .font(.subheadline.weight(.semibold))
                        .lineLimit(1)

                    HStack {
                        if let artist = active.artist, !artist.isEmpty {
                            Text(artist)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        if active.totalPages > 0 {
                            Text("\(active.completedPages)/\(active.totalPages) 页")
                                .font(.caption2.monospacedDigit())
                                .foregroundStyle(.secondary)
                        }
                    }

                    ProgressView(value: active.progressValue)
                        .progressViewStyle(.linear)

                    Text(active.statusText)
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                        .lineLimit(1)
                }
                .padding(8)
                .background(Color.secondary.opacity(0.06), in: RoundedRectangle(cornerRadius: 6))
            } else if let lastCompleted = manager.tasks.first(where: {
                if case .completed = $0.state { return true }
                return false
            }) {
                HStack(spacing: 6) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                        .font(.caption)
                    VStack(alignment: .leading, spacing: 1) {
                        Text("最近完成")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                        Text(lastCompleted.title)
                            .font(.caption.weight(.medium))
                            .lineLimit(1)
                    }
                }
                .padding(6)
            } else {
                Text("暂无下载任务。在网页中点击「下载到漫书」即可静默在后台完成下载入库。")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.vertical, 4)
            }

            Divider()

            // Actions
            VStack(spacing: 4) {
                Button {
                    openMainWindow()
                } label: {
                    HStack {
                        Label("打开漫书主窗口", systemImage: "macwindow")
                        Spacer()
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .padding(.vertical, 4)
                .padding(.horizontal, 6)

                Button {
                    Task { await model.sync() }
                } label: {
                    HStack {
                        Label("同步漫画库", systemImage: "arrow.clockwise")
                        Spacer()
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .padding(.vertical, 4)
                .padding(.horizontal, 6)

                Divider()

                Button {
                    NSApp.terminate(nil)
                } label: {
                    HStack {
                        Label("退出漫书", systemImage: "power")
                        Spacer()
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .padding(.vertical, 4)
                .padding(.horizontal, 6)
            }
        }
        .padding(12)
        .frame(width: 280)
    }

    private func openMainWindow() {
        NSApp.activate(ignoringOtherApps: true)
        for window in NSApp.windows {
            let className = String(describing: type(of: window))
            if window.canBecomeMain && !className.contains("StatusBar") && !className.contains("Popover") {
                window.makeKeyAndOrderFront(nil)
                return
            }
        }
    }
}
