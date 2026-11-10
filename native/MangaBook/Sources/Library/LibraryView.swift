import SwiftUI
import MangaBookCore

struct LibraryView: View {
    @Environment(AppModel.self) private var model

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
