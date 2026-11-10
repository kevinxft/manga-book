import SwiftUI

struct DownloadCenterView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var showManualInputSheet = false
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
                    showManualInputSheet = true
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

                Button("关闭下载中心", systemImage: "xmark") {
                    dismiss()
                }
                .labelStyle(.iconOnly)
                .buttonStyle(.plain)
                .help("关闭下载中心")
                .keyboardShortcut(.cancelAction)
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
        .sheet(isPresented: $showManualInputSheet) {
            ManualDownloadSheet()
                .environment(model)
        }
    }
}
