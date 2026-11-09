import AppKit
import MangaBookCore
import SwiftUI

enum OrganizerScope: String, CaseIterable {
    case unsorted = "未分类"
    case all = "全部漫画"
    case categorized = "已归类作者"
}

struct OrganizerView: View {
    @Environment(AppModel.self) private var model

    @State private var scope: OrganizerScope = .unsorted
    @State private var mangaQuery = ""
    @State private var authorQuery = ""
    @State private var selectedMangaIDs: Set<String> = []
    @State private var selectedAuthorDirectory: String?

    // Sheets & Dialogs
    @State private var isMoving = false
    @State private var showCreateSheet = false
    @State private var showMergeSheet = false
    @State private var showAliasSheet = false
    @State private var mergeTargets: [String] = []
    @State private var renameTarget: TargetDirectorySummary?
    @State private var renameName = ""
    @State private var deleteTarget: TargetDirectorySummary?
    @State private var showDeleteConfirm = false

    private var filteredManga: [MangaBook] {
        var list: [MangaBook]
        switch scope {
        case .unsorted:
            if let unsorted = model.unsortedRootPath {
                list = model.allBooks.filter { PathUtils.isInside($0.folderPath, unsorted) }
            } else {
                list = []
            }
        case .all:
            list = model.allBooks
        case .categorized:
            if let authorsRoot = model.authorsRootPath {
                list = model.allBooks.filter { PathUtils.isInside($0.folderPath, authorsRoot) }
            } else {
                list = []
            }
        }

        let q = mangaQuery.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if !q.isEmpty {
            list = list.filter {
                $0.title.lowercased().contains(q) || $0.folderPath.lowercased().contains(q)
            }
        }
        return list
    }

    private var filteredAuthors: [TargetDirectorySummary] {
        let q = authorQuery.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !q.isEmpty else { return model.authors }
        return model.authors.filter { author in
            let name = PathUtils.displayName(for: author.directory).lowercased()
            return name.contains(q)
        }
    }

    private var selectedAuthorName: String? {
        selectedAuthorDirectory.map { PathUtils.displayName(for: $0) }
    }

    var body: some View {
        HStack(spacing: 0) {
            // LEFT PANE: Manga Grid to select & organize
            VStack(spacing: 0) {
                mangaHeaderBar
                Divider()

                if filteredManga.isEmpty {
                    mangaEmptyState
                } else {
                    MangaGridView(
                        books: filteredManga,
                        tagsByMangaId: model.tagsByMangaId,
                        coverResolver: model.service?.coverResolver,
                        isOrganizerMode: true,
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
                        onSelectionChange: { selectedMangaIDs = $0 }
                    )
                }

                Divider()
                mangaFooterBar
            }
            .frame(minWidth: 460)

            Divider()

            // RIGHT PANE: Author Directory & Fast Move Action Panel
            VStack(spacing: 0) {
                authorPanelHeader
                Divider()

                moveActionCard
                Divider()

                authorSearchBar
                Divider()

                authorListView
                Divider()

                authorPanelFooter
            }
            .frame(width: 340)
            .background(.bar)
        }
        .navigationTitle("漫画整理")
        .navigationSubtitle("左侧勾选漫画，右侧一键移动至目标作者")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("新建作者…", systemImage: "folder.badge.plus") {
                    showCreateSheet = true
                }
            }

            ToolbarItem(placement: .primaryAction) {
                Button("别名", systemImage: "arrow.left.arrow.right") {
                    showAliasSheet = true
                }
                .help("管理作者别名映射")
            }

            ToolbarItem(placement: .primaryAction) {
                Button {
                    Task { await model.reload() }
                } label: {
                    Label("刷新", systemImage: "arrow.clockwise")
                }
                .help("刷新整理数据")
            }
        }
        .sheet(isPresented: $showCreateSheet) {
            CreateAuthorSheet(isPresented: $showCreateSheet) { name in
                Task {
                    if let path = await model.createAuthorDirectory(name: name) {
                        selectedAuthorDirectory = path
                    }
                }
            }
        }
        .sheet(isPresented: $showMergeSheet) {
            MergeAuthorSheet(
                mergeTargets: mergeTargets,
                isPresented: $showMergeSheet
            ) { targetName in
                let targets = mergeTargets
                Task {
                    await model.mergeAuthorDirectories(paths: targets, targetName: targetName)
                    mergeTargets = []
                }
            }
        }
        .sheet(isPresented: $showAliasSheet) {
            AuthorAliasesSheet(isPresented: $showAliasSheet)
                .environment(model)
        }
        .alert(
            "重命名作者目录",
            isPresented: Binding(
                get: { renameTarget != nil },
                set: { if !$0 { renameTarget = nil } }
            )
        ) {
            TextField("作者名", text: $renameName)
            Button("取消", role: .cancel) { renameTarget = nil }
            Button("重命名") {
                guard let target = renameTarget else { return }
                let name = renameName.trimmingCharacters(in: .whitespacesAndNewlines)
                renameTarget = nil
                guard !name.isEmpty else { return }
                Task { await model.renameAuthorDirectory(path: target.directory, to: name) }
            }
        }
        .confirmationDialog(
            "删除作者目录？",
            isPresented: $showDeleteConfirm
        ) {
            Button("移到废纸篓", role: .destructive) {
                guard let target = deleteTarget else { return }
                deleteTarget = nil
                Task { await model.deleteAuthorDirectory(path: target.directory) }
            }
        } message: {
            Text("只有不含漫画的作者目录才能删除。目录会被移到废纸篓。")
        }
    }

    // MARK: - Left: Manga Pane Components

    private var mangaHeaderBar: some View {
        HStack(spacing: Theme.Spacing.standard) {
            Picker("范围", selection: $scope) {
                Text("未分类 (\(model.unsortedCount))").tag(OrganizerScope.unsorted)
                Text("全部 (\(model.allBooks.count))").tag(OrganizerScope.all)
                Text("已归类 (\(model.authorsCount))").tag(OrganizerScope.categorized)
            }
            .pickerStyle(.segmented)
            .frame(maxWidth: 320)

            HStack(spacing: 5) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.tertiary)
                TextField("搜索漫画标题…", text: $mangaQuery)
                    .textFieldStyle(.plain)
                if !mangaQuery.isEmpty {
                    Button {
                        mangaQuery = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 5)
            .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: Theme.Radius.small))

            Spacer()

            if !filteredManga.isEmpty {
                Button(selectedMangaIDs.count == filteredManga.count ? "取消全选" : "全选") {
                    if selectedMangaIDs.count == filteredManga.count {
                        selectedMangaIDs.removeAll()
                    } else {
                        selectedMangaIDs = Set(filteredManga.map(\.id))
                    }
                }
                .controlSize(.small)
            }
        }
        .padding(.horizontal, Theme.Spacing.generous)
        .padding(.vertical, 8)
        .background(.bar)
    }

    private var mangaFooterBar: some View {
        HStack {
            if selectedMangaIDs.isEmpty {
                Text("点击漫画封面直接勾选，支持批量多选")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                HStack(spacing: 4) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(Color.accentColor)
                    Text("已勾选 \(selectedMangaIDs.count) 本漫画")
                        .font(.caption)
                        .bold()
                        .foregroundStyle(Color.accentColor)
                }

                Spacer()

                Button("清空勾选") {
                    selectedMangaIDs.removeAll()
                }
                .controlSize(.small)
            }

            Spacer()

            Text("显示 \(filteredManga.count) 本")
                .font(.caption.monospacedDigit())
                .foregroundStyle(.tertiary)
        }
        .padding(.horizontal, Theme.Spacing.generous)
        .padding(.vertical, 7)
        .background(.bar)
    }

    @ViewBuilder
    private var mangaEmptyState: some View {
        ContentUnavailableView {
            Label(
                scope == .unsorted ? "没有未分类漫画" : "没有找到漫画",
                systemImage: scope == .unsorted ? "checkmark.circle" : "books.vertical"
            )
        } description: {
            Text(scope == .unsorted ? "所有的漫画均已整理归类到对应的作者目录下！" : "当前筛选条件下没有漫画。")
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Right: Author Panel Components

    private var authorPanelHeader: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("目标作者目录")
                    .font(.headline)
                Text("选择右侧作者，一键将左侧已勾选漫画移动入库")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
        }
        .padding(.horizontal, Theme.Spacing.standard)
        .padding(.vertical, 10)
    }

    private var moveActionCard: some View {
        VStack(spacing: Theme.Spacing.tight) {
            // Main Big Move Button
            Button {
                executeMoveToSelectedAuthor()
            } label: {
                HStack(spacing: 6) {
                    if isMoving {
                        ProgressView()
                            .controlSize(.small)
                    } else {
                        Image(systemName: "arrow.right.circle.fill")
                            .font(.system(size: 15))
                    }

                    if let authorName = selectedAuthorName, !selectedMangaIDs.isEmpty {
                        Text("移动 \(selectedMangaIDs.count) 本到「\(authorName)」")
                            .bold()
                            .lineLimit(1)
                    } else if selectedMangaIDs.isEmpty {
                        Text("请在左侧勾选要移动的漫画")
                            .font(.subheadline)
                    } else {
                        Text("请在下方选择目标作者")
                            .font(.subheadline)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 4)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(selectedAuthorDirectory == nil || selectedMangaIDs.isEmpty || isMoving)

            // Secondary option: Move to Unsorted
            if let unsorted = model.unsortedRootPath, !selectedMangaIDs.isEmpty {
                Button {
                    executeMoveToUnsorted(unsorted)
                } label: {
                    Label("移至未分类 (Unsorted)", systemImage: "tray.and.arrow.down")
                        .font(.caption)
                }
                .buttonStyle(.plain)
                .foregroundStyle(.secondary)
                .disabled(isMoving)
            }
        }
        .padding(.horizontal, Theme.Spacing.standard)
        .padding(.vertical, Theme.Spacing.standard)
        .background(Color.secondary.opacity(0.06), in: RoundedRectangle(cornerRadius: Theme.Radius.standard))
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
    }

    private var authorSearchBar: some View {
        HStack(spacing: Theme.Spacing.tight) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(.tertiary)
            TextField("过滤作者目录…", text: $authorQuery)
                .textFieldStyle(.plain)
                .font(.callout)
            if !authorQuery.isEmpty {
                Button {
                    authorQuery = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 5)
        .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: Theme.Radius.small))
        .padding(.horizontal, Theme.Spacing.standard)
        .padding(.vertical, 6)
    }

    private var authorListView: some View {
        List(selection: $selectedAuthorDirectory) {
            ForEach(filteredAuthors) { author in
                let isTarget = selectedAuthorDirectory == author.directory
                AuthorSelectionRow(author: author, isTarget: isTarget)
                    .tag(author.directory)
                    .contextMenu {
                        Button("重命名…") {
                            renameTarget = author
                            renameName = PathUtils.displayName(for: author.directory)
                        }
                        Button("导入漫画到此目录…") {
                            Task { await model.importMangas(into: author.directory) }
                        }
                        Divider()
                        Button("在 Finder 中显示") {
                            NSWorkspace.shared.activateFileViewerSelecting([
                                URL(fileURLWithPath: author.directory, isDirectory: true)
                            ])
                        }
                        Divider()
                        Button("删除空目录", role: .destructive) {
                            deleteTarget = author
                            showDeleteConfirm = true
                        }
                    }
            }
        }
        .listStyle(.inset)
    }

    private var authorPanelFooter: some View {
        HStack {
            Text("共 \(model.authors.count) 位作者")
                .font(.caption)
                .foregroundStyle(.secondary)

            Spacer()

            if let target = selectedAuthorName {
                Text("目标: \(target)")
                    .font(.caption)
                    .bold()
                    .foregroundStyle(Color.accentColor)
                    .lineLimit(1)
            }
        }
        .padding(.horizontal, Theme.Spacing.standard)
        .padding(.vertical, 7)
    }

    // MARK: - Move Execution

    private func executeMoveToSelectedAuthor() {
        guard let target = selectedAuthorDirectory, !selectedMangaIDs.isEmpty, !isMoving else { return }
        isMoving = true
        let ids = Array(selectedMangaIDs)
        Task {
            await model.moveMangas(ids: ids, to: target)
            selectedMangaIDs.removeAll()
            isMoving = false
        }
    }

    private func executeMoveToUnsorted(_ unsortedPath: String) {
        guard !selectedMangaIDs.isEmpty, !isMoving else { return }
        isMoving = true
        let ids = Array(selectedMangaIDs)
        Task {
            await model.moveMangas(ids: ids, to: unsortedPath)
            selectedMangaIDs.removeAll()
            isMoving = false
        }
    }
}

private struct AuthorSelectionRow: View {
    let author: TargetDirectorySummary
    let isTarget: Bool

    var body: some View {
        HStack(spacing: Theme.Spacing.standard) {
            Image(systemName: isTarget ? "checkmark.circle.fill" : "folder.fill")
                .symbolRenderingMode(.hierarchical)
                .foregroundStyle(isTarget ? Color.accentColor : Color.secondary)
                .frame(width: 18)

            VStack(alignment: .leading, spacing: 2) {
                Text(PathUtils.displayName(for: author.directory))
                    .font(.body)
                    .fontWeight(isTarget ? .semibold : .regular)
                    .foregroundStyle(isTarget ? Color.accentColor : Color.primary)
                    .lineLimit(1)
            }

            Spacer()

            Text("\(author.mangaCount) 本")
                .font(.caption.monospacedDigit())
                .foregroundStyle(isTarget ? Color.accentColor.opacity(0.85) : Color.secondary)
                .padding(.horizontal, 5)
                .padding(.vertical, 1.5)
                .background(
                    Capsule().fill(isTarget ? Color.accentColor.opacity(0.18) : Color.secondary.opacity(0.10))
                )
        }
        .padding(.vertical, 2)
        .contentShape(Rectangle())
    }
}
