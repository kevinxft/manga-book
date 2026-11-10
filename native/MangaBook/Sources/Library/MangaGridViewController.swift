import AppKit
import MangaBookCore

final class MangaGridViewController: NSViewController, NSCollectionViewDelegate, NSCollectionViewPrefetching {
    private let scrollView = NSScrollView()
    private let collectionView = MangaCollectionView()
    private var dataSource: NSCollectionViewDiffableDataSource<Int, String>!

    private var booksById: [String: MangaBook] = [:]
    private var tagsById: [String: [MangaTag]] = [:]
    private var currentIDs: [String] = []
    private var contextBook: MangaBook?
    private var contextIDs: [String] = []
    private var lastSignature: Int?

    var isOrganizerMode = false {
        didSet {
            collectionView.isOrganizerMode = isOrganizerMode
        }
    }

    var coverResolver: CoverResolver?
    var onOpen: ((MangaBook) -> Void)?
    var onReveal: ((MangaBook) -> Void)?
    var onOpenFolder: ((MangaBook) -> Void)?
    var onEditTags: ((MangaBook) -> Void)?
    var onSetAuthor: (([String]) -> Void)?
    var onCopyPath: ((MangaBook) -> Void)?
    var onMove: (([String]) -> Void)?
    var onRename: ((MangaBook) -> Void)?
    var onDelete: (([String]) -> Void)?
    var onWebSearch: ((MangaBook, AppModel.WebProvider) -> Void)?
    var onSelectionChange: ((Set<String>) -> Void)?

    override func loadView() {
        let root = NSView()
        root.wantsLayer = true

        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.hasVerticalScroller = true
        scrollView.autohidesScrollers = true
        scrollView.drawsBackground = false
        scrollView.borderType = .noBorder
        root.addSubview(scrollView)

        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: root.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: root.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: root.bottomAnchor)
        ])

        let layout = NSCollectionViewFlowLayout()
        layout.itemSize = NSSize(width: 180, height: 298)
        layout.minimumInteritemSpacing = 20
        layout.minimumLineSpacing = 28
        layout.sectionInset = NSEdgeInsets(top: 24, left: 26, bottom: 32, right: 26)

        collectionView.collectionViewLayout = layout
        collectionView.isSelectable = true
        collectionView.allowsMultipleSelection = true
        collectionView.allowsEmptySelection = true
        collectionView.backgroundColors = [.clear]
        collectionView.delegate = self
        collectionView.prefetchDataSource = self
        collectionView.register(MangaGridItem.self, forItemWithIdentifier: MangaGridItem.identifier)
        collectionView.frame = NSRect(x: 0, y: 0, width: 900, height: 900)
        collectionView.autoresizingMask = [.width]
        collectionView.menuProvider = { [weak self] indexPath in
            self?.buildContextMenu(indexPath: indexPath)
        }
        collectionView.onSelectionChanged = { [weak self] in
            self?.notifySelection()
        }
        collectionView.singleClickAction = { [weak self] indexPath in
            guard let self else { return }
            guard indexPath.item >= 0, indexPath.item < currentIDs.count,
                  let book = booksById[currentIDs[indexPath.item]] else { return }
            notifySelection()
            onOpen?(book)
        }

        scrollView.documentView = collectionView

        let doubleClick = NSClickGestureRecognizer(target: self, action: #selector(handleDoubleClick(_:)))
        doubleClick.numberOfClicksRequired = 2
        collectionView.addGestureRecognizer(doubleClick)

        dataSource = NSCollectionViewDiffableDataSource<Int, String>(collectionView: collectionView) { [weak self] collectionView, indexPath, id in
            let item = collectionView.makeItem(withIdentifier: MangaGridItem.identifier, for: indexPath) as! MangaGridItem
            guard let self, let book = booksById[id] else { return item }
            item.configure(book: book, tags: tagsById[id] ?? [], coverResolver: coverResolver)
            return item
        }

        view = root
    }

    override func viewDidLayout() {
        super.viewDidLayout()
        let width = scrollView.contentView.bounds.width
        guard width > 0, abs(collectionView.frame.width - width) > 0.5 else { return }
        var frame = collectionView.frame
        frame.size.width = width
        collectionView.frame = frame
        collectionView.collectionViewLayout?.invalidateLayout()
    }

    func update(books: [MangaBook], tags: [String: [MangaTag]]) {
        let oldBooksById = booksById
        let ids = books.map(\.id)
        booksById = Dictionary(uniqueKeysWithValues: books.map { ($0.id, $0) })
        tagsById = tags
        currentIDs = ids

        guard isViewLoaded else {
            lastSignature = Self.signature(books)
            return
        }

        let signature = Self.signature(books)
        let previous = dataSource.snapshot()
        let previousFirst = previous.itemIdentifiers.first
        let idsChanged = previous.itemIdentifiers != ids
        let contentChanged = signature != lastSignature
        guard idsChanged || contentChanged else { return }
        lastSignature = signature

        if idsChanged {
            var snapshot = NSDiffableDataSourceSnapshot<Int, String>()
            snapshot.appendSections([0])
            snapshot.appendItems(ids, toSection: 0)
            dataSource.apply(snapshot, animatingDifferences: false)

            if previousFirst != ids.first {
                scrollView.contentView.scroll(to: .zero)
                scrollView.reflectScrolledClipView(scrollView.contentView)
            }
        } else if contentChanged {
            let changedIDs = ids.filter { id in
                oldBooksById[id] != booksById[id]
            }
            if !changedIDs.isEmpty {
                var reload = dataSource.snapshot()
                reload.reloadItems(changedIDs)
                dataSource.apply(reload, animatingDifferences: false)
            }
        }
    }

    private static func signature(_ books: [MangaBook]) -> Int {
        var hasher = Hasher()
        for book in books {
            hasher.combine(book.id)
            hasher.combine(book.title)
            hasher.combine(book.lastPageIndex)
            hasher.combine(book.totalPages)
            hasher.combine(book.isFavorite)
            hasher.combine(book.lastReadAt)
            hasher.combine(book.structure)
        }
        return hasher.finalize()
    }

    func collectionView(_ collectionView: NSCollectionView, didSelectItemsAt indexPaths: Set<IndexPath>) {
        notifySelection()
    }

    func collectionView(_ collectionView: NSCollectionView, didDeselectItemsAt indexPaths: Set<IndexPath>) {
        notifySelection()
    }

    private func notifySelection() {
        let ids = Set(collectionView.selectionIndexPaths.compactMap { indexPath -> String? in
            guard indexPath.item >= 0, indexPath.item < currentIDs.count else { return nil }
            return currentIDs[indexPath.item]
        })
        onSelectionChange?(ids)
    }

    func collectionView(_ collectionView: NSCollectionView, prefetchItemsAt indexPaths: [IndexPath]) {
        for indexPath in indexPaths {
            guard indexPath.item >= 0, indexPath.item < currentIDs.count,
                  let book = booksById[currentIDs[indexPath.item]] else { continue }
            prefetch(book)
        }
    }

    func collectionView(_ collectionView: NSCollectionView, cancelPrefetchingForItemsAt indexPaths: [IndexPath]) {}

    private func prefetch(_ book: MangaBook) {
        guard let coverResolver else { return }
        Task.detached(priority: .utility) {
            guard let cover = await coverResolver.resolveCoverPath(for: book.folderPath) else { return }
            _ = await ThumbnailService.shared.thumbnail(forImagePath: cover)
        }
    }

    @objc private func handleDoubleClick(_ gesture: NSClickGestureRecognizer) {
        let point = gesture.location(in: collectionView)
        guard let indexPath = collectionView.indexPathForItem(at: point),
              indexPath.item >= 0, indexPath.item < currentIDs.count,
              let book = booksById[currentIDs[indexPath.item]] else { return }
        onOpen?(book)
    }

    private func buildContextMenu(indexPath: IndexPath?) -> NSMenu? {
        guard let indexPath, indexPath.item >= 0, indexPath.item < currentIDs.count,
              let book = booksById[currentIDs[indexPath.item]] else { return nil }
        contextBook = book
        contextIDs = selectedBooks().map(\.id)
        if contextIDs.isEmpty { contextIDs = [book.id] }
        notifySelection()

        let isSingle = contextIDs.count <= 1
        let menu = NSMenu()

        if isSingle {
            menu.addItem(menuItem("阅读", action: #selector(contextOpen)))
            menu.addItem(.separator())
        }

        menu.addItem(menuItem(isSingle ? "设置作者…" : "设置作者…（\(contextIDs.count) 本）", action: #selector(contextSetAuthor)))
        menu.addItem(menuItem(isSingle ? "移动到…" : "移动所选 \(contextIDs.count) 本到…", action: #selector(contextMove)))
        if isSingle {
            menu.addItem(menuItem("重命名…", action: #selector(contextRename)))
            menu.addItem(menuItem("编辑标签…", action: #selector(contextEditTags)))

            let searchItem = NSMenuItem(title: "网络搜索", action: nil, keyEquivalent: "")
            let submenu = NSMenu()
            for provider in AppModel.WebProvider.allCases {
                let item = NSMenuItem(title: provider.label, action: #selector(contextSearchWeb(_:)), keyEquivalent: "")
                item.target = self
                item.representedObject = provider.rawValue
                submenu.addItem(item)
            }
            searchItem.submenu = submenu
            menu.addItem(searchItem)
        }
        menu.addItem(menuItem(isSingle ? "删除…" : "删除所选 \(contextIDs.count) 本…", action: #selector(contextDelete)))

        menu.addItem(.separator())
        menu.addItem(menuItem("在 Finder 中显示", action: #selector(contextReveal)))
        menu.addItem(menuItem("打开文件夹", action: #selector(contextOpenFolder)))
        menu.addItem(menuItem("复制路径", action: #selector(contextCopyPath)))
        return menu
    }

    private func selectedBooks() -> [MangaBook] {
        collectionView.selectionIndexPaths.compactMap { indexPath in
            guard indexPath.item >= 0, indexPath.item < currentIDs.count else { return nil }
            return booksById[currentIDs[indexPath.item]]
        }
    }

    private func menuItem(_ title: String, action: Selector) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: action, keyEquivalent: "")
        item.target = self
        return item
    }

    @objc private func contextOpen() {
        guard let contextBook else { return }
        onOpen?(contextBook)
    }

    @objc private func contextReveal() {
        guard let contextBook else { return }
        onReveal?(contextBook)
    }

    @objc private func contextOpenFolder() {
        guard let contextBook else { return }
        onOpenFolder?(contextBook)
    }

    @objc private func contextEditTags() {
        guard let contextBook, contextIDs.count <= 1 else { return }
        onEditTags?(contextBook)
    }

    @objc private func contextSetAuthor() {
        onSetAuthor?(contextIDs)
    }

    @objc private func contextCopyPath() {
        guard let contextBook else { return }
        onCopyPath?(contextBook)
    }

    @objc private func contextMove() {
        onMove?(contextIDs)
    }

    @objc private func contextRename() {
        guard let contextBook, contextIDs.count <= 1 else { return }
        onRename?(contextBook)
    }

    @objc private func contextDelete() {
        onDelete?(contextIDs)
    }

    @objc private func contextSearchWeb(_ sender: NSMenuItem) {
        guard let contextBook,
              let raw = sender.representedObject as? String,
              let provider = AppModel.WebProvider(rawValue: raw) else { return }
        onWebSearch?(contextBook, provider)
    }
}
