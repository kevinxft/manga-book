import AppKit
import MangaBookCore
import SwiftUI

enum ReaderMode: String {
    case paged
    case scroll
}

enum ReaderWidthMode: String {
    case fit
    case fixed
}

struct ReaderView: View {
    let book: MangaBook

    @Environment(AppModel.self) private var model
    @Environment(\.dismissWindow) private var dismissWindow

    @AppStorage("reader.mode") private var modeRaw = ReaderMode.paged.rawValue
    @AppStorage("reader.widthMode") private var widthModeRaw = ReaderWidthMode.fit.rawValue
    @AppStorage("reader.widthPercent") private var widthPercent = 90.0
    @AppStorage("reader.rememberProgress") private var rememberProgress = true

    @State private var pages: [String] = []
    @State private var chapters: [ReaderChapter] = []
    @State private var currentIndex = 0
    @State private var scrollPageID: Int?
    @State private var loading = true
    @State private var errorText: String?
    @State private var showChapterPanel = false
    @State private var showPageEditor = false
    @State private var showTagEditor = false
    @State private var showDeleteConfirmation = false
    @State private var deletingManga = false
    @State private var renamingChapter: ReaderChapter?
    @State private var renameText = ""
    @State private var chapterBusy = false
    @State private var saveTask: Task<Void, Never>?

    private var mode: ReaderMode { ReaderMode(rawValue: modeRaw) ?? .paged }
    private var widthMode: ReaderWidthMode { ReaderWidthMode(rawValue: widthModeRaw) ?? .fit }
    private var widthFraction: CGFloat {
        widthMode == .fit ? 1 : CGFloat(min(100, max(50, widthPercent)) / 100)
    }

    private var currentChapterIndex: Int {
        guard !chapters.isEmpty else { return 0 }
        for index in chapters.indices.reversed() where currentIndex >= chapters[index].startPageIndex {
            return index
        }
        return 0
    }

    private var currentChapterID: String? {
        chapters.indices.contains(currentChapterIndex) ? chapters[currentChapterIndex].id : nil
    }

    private var canAddChapter: Bool {
        book.structure == .singleVolume && pages.count > 1
    }

    private var canAddAtCurrentPage: Bool {
        canAddChapter && currentIndex > 0 && !chapters.contains { $0.startPageIndex == currentIndex }
    }

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Color.black.ignoresSafeArea()

            VStack(spacing: 0) {
                topBar
                viewport
                bottomBar
            }

            if showChapterPanel {
                chapterPanel
                    .padding(.top, 48)
                    .transition(.move(edge: .trailing))
            }
        }
        .environment(\.colorScheme, .dark)
        .frame(minWidth: 980, minHeight: 700)
        .background(
            KeyboardMonitor { command in
                handleKey(command)
            }
        )
        .task { await load() }
        .onDisappear {
            saveTask?.cancel()
            saveProgressNow()
        }
        .sheet(isPresented: $showPageEditor) {
            PageEditorSheet(
                pages: pages,
                deleting: false,
                onDelete: { selected in
                    deletePages(selected)
                }
            )
        }
        .sheet(isPresented: $showTagEditor) {
            TagEditorSheet(book: book)
                .environment(model)
        }
        .confirmationDialog("删除这本漫画？", isPresented: $showDeleteConfirmation) {
            Button("移到废纸篓并删除记录", role: .destructive) {
                deleteManga()
            }
        } message: {
            Text("漫画目录会被移到废纸篓，同时删除数据库记录。")
        }
        .alert(
            "出错了",
            isPresented: Binding(
                get: { errorText != nil },
                set: { if !$0 { errorText = nil } }
            )
        ) {
            Button("好", role: .cancel) { errorText = nil }
        } message: {
            Text(errorText ?? "")
        }
    }

    // MARK: - Navigation & Bars

    private var topBar: some View {
        HStack(spacing: Theme.Spacing.standard) {
            Button(action: close) {
                Image(systemName: "chevron.left")
                    .font(.system(size: 13, weight: .semibold))
                    .frame(width: 28, height: 28)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .help("返回（Esc）")

            VStack(alignment: .leading, spacing: 2) {
                Text(book.title)
                    .font(.headline)
                    .lineLimit(1)

                HStack(spacing: Theme.Spacing.tight) {
                    Button {
                        model.requestSetAuthor(for: book)
                    } label: {
                        HStack(spacing: 3) {
                            Image(systemName: "person.fill")
                                .font(.system(size: 9))
                            Text(model.authorName(for: book) ?? "设置作者")
                                .font(.system(size: 10, weight: .semibold))
                        }
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .contentShape(Capsule())
                    }
                    .buttonStyle(.plain)
                    .liquidGlassCapsule(interactive: true, tint: Color.accentColor)
                    .help("设置或更改此漫画的作者目录")

                    ForEach(model.tags(for: book).prefix(3)) { tag in
                        Text(tag.name)
                            .font(.system(size: 10, weight: .medium))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 1)
                            .background(Capsule().fill(Color.white.opacity(0.12)))
                    }
                    Text("\(min(currentIndex + 1, max(pages.count, 1))) / \(pages.count)")
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
            }

            Spacer(minLength: 8)

            HStack(spacing: 6) {
                HandsFreeReaderControl { command in
                    handleVoiceCommand(command)
                }

                iconButton("list.bullet.rectangle", help: "章节列表") {
                    withAnimation(.easeOut(duration: 0.15)) { showChapterPanel.toggle() }
                }
                iconButton("square.grid.2x2", help: "页面管理") { showPageEditor = true }
                iconButton("tag", help: "编辑标签") { showTagEditor = true }
                iconButton("folder", help: "在 Finder 中显示") { model.reveal(book) }
                iconButton("trash", help: "删除漫画") { showDeleteConfirmation = true }
                Divider().frame(height: 18).padding(.horizontal, 4)
                iconButton("xmark", help: "关闭窗口（Esc）", action: close)
            }
        }
        .padding(.horizontal, Theme.Spacing.generous)
        .frame(height: 50)
        .applyLiquidGlass(in: .rect(cornerRadius: 0))
    }

    private func iconButton(_ systemName: String, help: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 14))
                .frame(width: 30, height: 30)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .help(help)
    }

    private var viewport: some View {
        GeometryReader { geometry in
            ZStack {
                Color.black

                if loading {
                    ProgressView("正在载入漫画…")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                } else if let errorText {
                    ContentUnavailableView {
                        Label("无法加载漫画", systemImage: "exclamationmark.triangle")
                            .foregroundStyle(.orange)
                    } description: {
                        Text(errorText)
                    }
                } else if pages.isEmpty {
                    ContentUnavailableView("此漫画暂无任何页面", systemImage: "photo.on.rectangle.angled")
                } else if mode == .paged {
                    pagedViewport(geometry)
                } else {
                    scrollViewport(geometry)
                }
            }
        }
    }

    private func pagedViewport(_ geometry: GeometryProxy) -> some View {
        let maxPixel = Int(max(geometry.size.width, geometry.size.height) * 2)
        return ZStack {
            if currentIndex < pages.count {
                PageImageView(path: pages[currentIndex], maxPixelSize: maxPixel)
                    .frame(
                        maxWidth: geometry.size.width * widthFraction,
                        maxHeight: geometry.size.height - 16
                    )
                    .padding(.horizontal, Theme.Spacing.standard)
            }

            MouseClickCatcher(
                onLeftClick: { setPage(currentIndex + 1) },
                onRightClick: { setPage(currentIndex - 1) }
            )
        }
    }

    private func scrollViewport(_ geometry: GeometryProxy) -> some View {
        let maxPixel = Int(max(geometry.size.width, 1200) * 2)
        return ScrollView(.vertical) {
            LazyVStack(spacing: Theme.Spacing.generous) {
                ForEach(Array(pages.enumerated()), id: \.offset) { index, path in
                    PageImageView(path: path, maxPixelSize: maxPixel)
                        .frame(maxWidth: geometry.size.width * widthFraction)
                        .frame(maxWidth: .infinity)
                        .id(index)
                }
            }
            .scrollTargetLayout()
            .padding(.vertical, Theme.Spacing.generous)
        }
        .scrollPosition(id: $scrollPageID)
        .onChange(of: scrollPageID) { _, newValue in
            guard let newValue else { return }
            setPage(newValue, scroll: false)
        }
    }

    private var bottomBar: some View {
        HStack(spacing: Theme.Spacing.standard) {
            Button { setPage(currentIndex - 1) } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 13, weight: .semibold))
            }
            .buttonStyle(.plain)
            .disabled(currentIndex <= 0)

            Slider(
                value: Binding(
                    get: { Double(currentIndex + 1) },
                    set: { setPage(Int($0.rounded()) - 1, save: false) }
                ),
                in: 1...Double(max(pages.count, 1)),
                onEditingChanged: { editing in
                    if !editing { scheduleSave() }
                }
            )
            .disabled(pages.isEmpty)

            Button { setPage(currentIndex + 1) } label: {
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
            }
            .buttonStyle(.plain)
            .disabled(currentIndex >= pages.count - 1)

            Text("\(min(currentIndex + 1, max(pages.count, 1))) / \(pages.count)")
                .font(.caption.monospacedDigit())
                .foregroundStyle(.secondary)
                .frame(width: 76, alignment: .leading)

            Picker("", selection: $modeRaw) {
                Text("翻页").tag(ReaderMode.paged.rawValue)
                Text("滚动").tag(ReaderMode.scroll.rawValue)
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            .frame(width: 124)

            Menu {
                Button("适应宽度") { widthModeRaw = ReaderWidthMode.fit.rawValue }
                Divider()
                ForEach([50, 60, 70, 80, 90, 100], id: \.self) { percent in
                    Button("\(percent)%") {
                        widthModeRaw = ReaderWidthMode.fixed.rawValue
                        widthPercent = Double(percent)
                    }
                }
            } label: {
                Text(widthMode == .fit ? "适应" : "\(Int(widthPercent))%")
                    .font(.caption.monospacedDigit())
                    .frame(width: 44)
            }
            .menuStyle(.borderlessButton)
            .fixedSize()

            Button { showPageEditor = true } label: {
                Image(systemName: "rectangle.split.3x1")
            }
            .buttonStyle(.plain)
            .help("页面管理")
        }
        .padding(.horizontal, Theme.Spacing.generous)
        .frame(height: 52)
        .applyLiquidGlass(in: .rect(cornerRadius: 0))
    }

    // MARK: - Chapter panel

    private var chapterPanel: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("章节列表")
                    .font(.headline)
                Spacer()
                Button {
                    withAnimation(.easeOut(duration: 0.15)) { showChapterPanel = false }
                } label: {
                    Image(systemName: "xmark")
                }
                .buttonStyle(.plain)
            }
            .padding(Theme.Spacing.standard)

            Divider()

            if chapters.isEmpty {
                ContentUnavailableView {
                    Label("暂无章节", systemImage: "bookmark")
                } description: {
                    Text("单卷漫画可点击下方按钮，在当前页新增章节起点。")
                }
                .frame(maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(Array(chapters.enumerated()), id: \.element.id) { index, chapter in
                            chapterRow(index: index, chapter: chapter)
                        }
                    }
                }
            }

            Divider()

            Button {
                addChapter()
            } label: {
                Label("在当前页新增章节", systemImage: "plus.circle.fill")
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.plain)
            .padding(Theme.Spacing.standard)
            .disabled(!canAddAtCurrentPage || chapterBusy)
            .opacity(canAddAtCurrentPage ? 1 : 0.45)
        }
        .frame(width: 310)
        .frame(maxHeight: .infinity)
        .background(.ultraThinMaterial)
        .overlay(alignment: .leading) {
            Rectangle().fill(Color.white.opacity(0.08)).frame(width: 0.5)
        }
        .alert(
            "重命名章节",
            isPresented: Binding(
                get: { renamingChapter != nil },
                set: { if !$0 { renamingChapter = nil } }
            )
        ) {
            TextField("章节名", text: $renameText)
            Button("取消", role: .cancel) { renamingChapter = nil }
            Button("保存") { commitRename() }
        }
    }

    private func chapterRow(index: Int, chapter: ReaderChapter) -> some View {
        Button {
            setPage(chapter.startPageIndex)
            withAnimation(.easeOut(duration: 0.15)) { showChapterPanel = false }
        } label: {
            HStack(spacing: Theme.Spacing.tight) {
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 5) {
                        if chapter.highlighted {
                            Image(systemName: "star.fill")
                                .font(.system(size: 10))
                                .foregroundStyle(.yellow)
                        }
                        Text(chapter.title)
                            .font(.body)
                            .lineLimit(1)
                    }
                    Text("第 \(chapter.startPageIndex + 1)–\(chapter.endPageIndex + 1) 页 · \(chapter.pageCount) 页")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer(minLength: 4)
                if chapter.id == currentChapterID {
                    Image(systemName: "checkmark")
                        .font(.caption)
                        .foregroundStyle(Color.accentColor)
                }
            }
            .padding(.horizontal, Theme.Spacing.standard)
            .padding(.vertical, 8)
            .contentShape(Rectangle())
            .background(chapter.id == currentChapterID ? Color.accentColor.opacity(0.12) : Color.clear)
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button("重命名…") {
                renamingChapter = chapter
                renameText = chapter.title
            }
            Button(chapter.highlighted ? "取消高亮" : "高亮标记") {
                updateChapter(chapter, title: nil, highlighted: !chapter.highlighted)
            }
            if chapter.deletable {
                Divider()
                Button("删除章节", role: .destructive) {
                    removeChapter(chapter)
                }
            }
        }
    }

    // MARK: - Actions

    private func load() async {
        guard let service = model.service else { return }
        loading = true
        errorText = nil
        let targetBook = book
        do {
            let (freshBook, pagePaths, chapterList) = try await Task.detached(priority: .userInitiated) {
                let fresh = (try? service.manga.getById(targetBook.id)) ?? targetBook
                let pages = try service.reader.listPagePaths(for: fresh)
                let chapters = try service.reader.listChapters(for: fresh)
                return (fresh, pages, chapters)
            }.value

            pages = pagePaths
            chapters = chapterList
            let start = min(max(freshBook.lastPageIndex, 0), max(pagePaths.count - 1, 0))
            currentIndex = start
            scrollPageID = start
            loading = false
        } catch {
            errorText = error.localizedDescription
            loading = false
        }
    }

    private func setPage(_ index: Int, scroll: Bool = true, save: Bool = true) {
        guard !pages.isEmpty else { return }
        let clamped = min(max(index, 0), pages.count - 1)
        if clamped != currentIndex {
            currentIndex = clamped
        }
        if scroll, mode == .scroll, scrollPageID != clamped {
            scrollPageID = clamped
        }
        if save {
            scheduleSave()
        }
    }

    private func handleKey(_ command: ReaderKeyCommand) -> Bool {
        switch command {
        case .next:
            setPage(currentIndex + 1)
        case .previous:
            setPage(currentIndex - 1)
        case .escape:
            close()
        case .toggleWidth:
            widthModeRaw = widthMode == .fit ? ReaderWidthMode.fixed.rawValue : ReaderWidthMode.fit.rawValue
        }
        return true
    }

    private func handleVoiceCommand(_ command: VoiceCommand) {
        switch command {
        case .nextPage:
            setPage(currentIndex + 1)
        case .previousPage:
            setPage(currentIndex - 1)
        case .close:
            close()
        }
    }

    private func scheduleSave() {
        guard rememberProgress, let service = model.service, !pages.isEmpty else { return }
        saveTask?.cancel()
        let mangaId = book.id
        let pageIndex = currentIndex
        let chapterIndex = currentChapterIndex
        let total = pages.count
        saveTask = Task {
            try? await Task.sleep(for: .milliseconds(280))
            guard !Task.isCancelled else { return }
            Task.detached(priority: .utility) {
                try? service.reader.saveProgress(
                    mangaId: mangaId,
                    chapterIndex: chapterIndex,
                    pageIndex: pageIndex,
                    totalPages: total
                )
            }
            await MainActor.run {
                model.updateBookProgress(id: mangaId, pageIndex: pageIndex, totalPages: total)
            }
        }
    }

    private func saveProgressNow() {
        guard rememberProgress, let service = model.service, !pages.isEmpty else { return }
        let mangaId = book.id
        let chapterIndex = currentChapterIndex
        let pageIndex = currentIndex
        let total = pages.count
        Task.detached(priority: .utility) {
            try? service.reader.saveProgress(
                mangaId: mangaId,
                chapterIndex: chapterIndex,
                pageIndex: pageIndex,
                totalPages: total
            )
        }
        model.updateBookProgress(id: mangaId, pageIndex: pageIndex, totalPages: total)
    }

    private func addChapter() {
        guard canAddAtCurrentPage, let service = model.service, !chapterBusy else { return }
        chapterBusy = true
        let pageIndex = currentIndex
        Task {
            do {
                chapters = try service.reader.addChapter(mangaId: book.id, pageIndex: pageIndex)
            } catch {
                errorText = error.localizedDescription
            }
            chapterBusy = false
        }
    }

    private func removeChapter(_ chapter: ReaderChapter) {
        guard chapter.deletable, let service = model.service, !chapterBusy else { return }
        chapterBusy = true
        Task {
            do {
                chapters = try service.reader.removeChapter(mangaId: book.id, chapterId: chapter.id)
            } catch {
                errorText = error.localizedDescription
            }
            chapterBusy = false
        }
    }

    private func updateChapter(_ chapter: ReaderChapter, title: String?, highlighted: Bool?) {
        guard let service = model.service, !chapterBusy else { return }
        chapterBusy = true
        Task {
            do {
                chapters = try service.reader.updateChapter(
                    mangaId: book.id,
                    chapterId: chapter.id,
                    title: title,
                    highlighted: highlighted
                )
            } catch {
                errorText = error.localizedDescription
            }
            chapterBusy = false
        }
    }

    private func commitRename() {
        guard let chapter = renamingChapter else { return }
        let name = renameText
        renamingChapter = nil
        updateChapter(chapter, title: name, highlighted: nil)
    }

    private func deletePages(_ selected: Set<String>) {
        guard let service = model.service, !selected.isEmpty else { return }
        Task {
            do {
                let result = try service.reader.deletePages(mangaId: book.id, pagePaths: Array(selected))
                let freshBook = (try service.manga.getById(book.id)) ?? book
                let pagePaths = try service.reader.listPagePaths(for: freshBook)
                pages = pagePaths
                chapters = try service.reader.listChapters(for: freshBook)
                currentIndex = min(currentIndex, max(pagePaths.count - 1, 0))
                scrollPageID = currentIndex
                model.updateBookProgress(id: book.id, pageIndex: currentIndex, totalPages: result.total)
                showPageEditor = false
            } catch {
                errorText = error.localizedDescription
            }
        }
    }

    private func deleteManga() {
        guard !deletingManga else { return }
        deletingManga = true
        Task {
            await model.deleteManga(book)
            deletingManga = false
            close()
        }
    }

    private func close() {
        dismissWindow(id: "reader", value: book.id)
        model.closeReader()
    }
}
