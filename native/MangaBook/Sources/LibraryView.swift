import SwiftUI
import MangaBookCore

struct LibraryView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        @Bindable var model = model

        VStack(spacing: 0) {
            if !model.tags.isEmpty {
                TagFilterBar()
                Divider()
            }

            Group {
                if model.visibleBooks.isEmpty {
                    emptyStateView
                } else {
                    MangaGridView(
                        books: model.visibleBooks,
                        tagsByMangaId: model.tagsByMangaId,
                        coverResolver: model.service?.coverResolver,
                        onOpen: { book in model.openReader(book) },
                        onReveal: { model.reveal($0) },
                        onOpenFolder: { model.openFolder($0) },
                        onEditTags: { model.editTags(for: $0) },
                        onSetAuthor: { model.requestSetAuthor(ids: $0) },
                        onCopyPath: { model.copyPath($0) },
                        onMove: { model.requestMove(ids: $0) },
                        onRename: { model.renameTarget = $0 },
                        onDelete: { model.requestDelete(ids: $0) },
                        onWebSearch: { book, provider in model.openWebSearch(provider, query: book.title) },
                        onSelectionChange: { model.selectedIDs = $0 }
                    )
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            Divider()
            LibraryStatusBarView()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .navigationTitle(model.activeSelectionTitle)
        .navigationSubtitle("\(model.visibleBooks.count) 本")
        .searchable(text: $model.searchText, placement: .toolbar, prompt: "搜索标题或路径")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                VoiceSearchButton { text in
                    model.searchText = text
                }
            }

            ToolbarItem(placement: .primaryAction) {
                Menu {
                    Picker("排序", selection: $model.sort) {
                        ForEach(MangaSort.allCases, id: \.self) { option in
                            Text(option.label).tag(option)
                        }
                    }
                    .pickerStyle(.inline)
                } label: {
                    Label("排序", systemImage: "arrow.up.arrow.down")
                }
                .help("更改排序")
            }

            ToolbarItem(placement: .primaryAction) {
                Button {
                    Task { await model.sync() }
                } label: {
                    Label("同步", systemImage: "arrow.clockwise")
                }
                .disabled(model.isScanning)
                .help("重新扫描漫画库（⌘R）")
            }
        }
    }

    @ViewBuilder
    private var emptyStateView: some View {
        Group {
            if !model.searchText.isEmpty {
                ContentUnavailableView.search
            } else if model.selectedTag != nil {
                ContentUnavailableView {
                    Label("此标签下无漫画", systemImage: "tag")
                } description: {
                    Text("标签「\(model.selectedTag ?? "")」下暂无漫画。")
                } actions: {
                    Button("清除标签筛选") {
                        model.selectedTag = nil
                    }
                    .buttonStyle(.borderedProminent)
                }
            } else if model.allBooks.isEmpty {
                ContentUnavailableView {
                    Label("漫画库为空", systemImage: "books.vertical")
                } description: {
                    Text("点击右上角同步按钮开始扫描，或将漫画目录导入到未分类。")
                } actions: {
                    Button("立即同步", systemImage: "arrow.clockwise") {
                        Task { await model.sync() }
                    }
                    .buttonStyle(.borderedProminent)
                }
            } else {
                ContentUnavailableView {
                    Label("此分类下无漫画", systemImage: "tray")
                } description: {
                    Text("当前筛选条件下未找到任何漫画。")
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

private struct TagFilterBar: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            LiquidGlass.container(spacing: Theme.Spacing.tight) {
                HStack(spacing: Theme.Spacing.tight) {
                    TagPillButton(
                        title: "全部",
                        systemImage: "square.grid.2x2",
                        count: nil,
                        isSelected: model.selectedTag == nil
                    ) {
                        model.selectedTag = nil
                    }

                    ForEach(model.tags) { tag in
                        let count = model.tagCount(tag.name)
                        TagPillButton(
                            title: tag.name,
                            systemImage: "tag.fill",
                            count: count,
                            isSelected: model.selectedTag == tag.name
                        ) {
                            if model.selectedTag == tag.name {
                                model.selectedTag = nil
                            } else {
                                model.selectedTag = tag.name
                            }
                        }
                        .contextMenu {
                            Button("删除标签", role: .destructive) {
                                Task { await model.deleteTag(tag) }
                            }
                        }
                    }

                    if model.selectedTag != nil {
                        Button {
                            model.selectedTag = nil
                        } label: {
                            HStack(spacing: 3) {
                                Image(systemName: "xmark.circle.fill")
                                    .font(.caption)
                                Text("清除筛选")
                                    .font(.caption)
                            }
                            .foregroundStyle(.secondary)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, Theme.Spacing.generous)
                .padding(.vertical, 8)
            }
        }
        .background(.bar)
    }
}

private struct TagPillButton: View {
    let title: String
    let systemImage: String
    let count: Int?
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 5) {
                Image(systemName: systemImage)
                    .font(.caption2)
                    .foregroundStyle(isSelected ? Color.accentColor : Color.secondary)

                Text(title)
                    .font(.caption)
                    .fontWeight(isSelected ? .semibold : .regular)
                    .foregroundStyle(isSelected ? Color.accentColor : Color.primary)

                if let count {
                    Text("\(count)")
                        .font(.caption2.monospacedDigit())
                        .foregroundStyle(isSelected ? Color.accentColor.opacity(0.85) : Color.secondary)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 1)
                        .background(
                            Capsule().fill(isSelected ? Color.accentColor.opacity(0.18) : Color.secondary.opacity(0.12))
                        )
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .liquidGlassCapsule(interactive: true, tint: isSelected ? Color.accentColor : nil)
        .animation(.snappy(duration: 0.16), value: isSelected)
    }
}

private struct LibraryStatusBarView: View {
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
        var parts: [String] = [progress.message]
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
