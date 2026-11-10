import MangaBookCore
import SwiftUI

struct LibraryStatusBarView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        HStack(spacing: Theme.Spacing.standard) {
            if model.isScanning, let progress = model.scanProgress {
                ProgressView(
                    value: Double(progress.itemTotal > 0 ? progress.itemCurrent : progress.sourceCurrent),
                    total: Double(max(progress.itemTotal > 0 ? progress.itemTotal : progress.sourceTotal, 1))
                )
                .progressViewStyle(.linear)
                .frame(width: 130)

                Text(statusText(progress))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.middle)

                Spacer()

                Button("取消", action: model.cancelSync)
                    .controlSize(.small)
            } else {
                HStack(spacing: 6) {
                    Circle()
                        .fill(Color.secondary.opacity(0.4))
                        .frame(width: 6, height: 6)
                    Text("\(model.visibleBooks.count) 本")
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Text("\(model.allBooks.count) 本 · \(model.authors.count) 位作者")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.horizontal, Theme.Spacing.generous)
        .padding(.vertical, 7)
        .background(.bar)
    }

    private func statusText(_ progress: ScanProgressPayload) -> String {
        var parts = [progress.message]
        if progress.sourceTotal > 0 {
            parts.append("来源 \(progress.sourceCurrent)/\(progress.sourceTotal)")
        }
        if progress.itemTotal > 0 {
            parts.append("\(progress.itemCurrent)/\(progress.itemTotal)")
        }
        if !progress.currentItemName.isEmpty {
            parts.append(progress.currentItemName)
        }
        return parts.joined(separator: " · ")
    }
}
