import SwiftUI

struct PageEditorSheet: View {
    let pages: [String]
    let deleting: Bool
    var onDelete: (Set<String>) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var selected: Set<String> = []
    @State private var confirming = false

    private var columns: [GridItem] {
        [GridItem(.adaptive(minimum: 120), spacing: Theme.Spacing.standard, alignment: .top)]
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.standard) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("页面管理")
                        .font(.title3)
                        .bold()
                    Text("共 \(pages.count) 页 · 可选择不需要的页面批量删除")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Button("关闭") { dismiss() }
                    .keyboardShortcut(.cancelAction)
            }

            if pages.isEmpty {
                ContentUnavailableView {
                    Label("无可用页面", systemImage: "photo.on.rectangle.angled")
                }
            } else {
                ScrollView {
                    LazyVGrid(columns: columns, alignment: .leading, spacing: Theme.Spacing.standard) {
                        ForEach(Array(pages.enumerated()), id: \.offset) { index, path in
                            PageCellView(
                                index: index,
                                path: path,
                                isSelected: selected.contains(path)
                            ) {
                                toggleSelection(path)
                            }
                        }
                    }
                    .padding(Theme.Spacing.tight)
                }
                .background(Color.secondary.opacity(0.04), in: RoundedRectangle(cornerRadius: Theme.Radius.standard))
            }

            HStack {
                Text(selected.isEmpty ? "未选择页面" : "已选择 \(selected.count) 页")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Spacer()

                Button("全选") {
                    selected = Set(pages)
                }
                .disabled(selected.count == pages.count)

                Button("取消选择") {
                    selected.removeAll()
                }
                .disabled(selected.isEmpty)

                Button("删除所选", role: .destructive) {
                    confirming = true
                }
                .buttonStyle(.borderedProminent)
                .disabled(selected.isEmpty || deleting)
            }
        }
        .padding(Theme.Spacing.generous)
        .frame(width: 820, height: 640)
        .confirmationDialog("删除所选页面？", isPresented: $confirming) {
            Button("移到废纸篓", role: .destructive) {
                onDelete(selected)
            }
        } message: {
            Text("所选页面将被移到废纸篓，不可撤销。至少需要保留 1 页。")
        }
    }

    private func toggleSelection(_ path: String) {
        if selected.contains(path) {
            selected.remove(path)
        } else {
            selected.insert(path)
        }
    }
}
