import MangaBookCore
import SwiftUI

struct MangaGridView: NSViewControllerRepresentable {
    var books: [MangaBook]
    var tagsByMangaId: [String: [MangaTag]]
    var coverResolver: CoverResolver?
    var isOrganizerMode: Bool = false
    var onOpen: (MangaBook) -> Void
    var onReveal: (MangaBook) -> Void
    var onOpenFolder: (MangaBook) -> Void
    var onEditTags: (MangaBook) -> Void
    var onSetAuthor: ([String]) -> Void
    var onCopyPath: (MangaBook) -> Void
    var onMove: ([String]) -> Void
    var onRename: (MangaBook) -> Void
    var onDelete: ([String]) -> Void
    var onWebSearch: (MangaBook, AppModel.WebProvider) -> Void
    var onSelectionChange: (Set<String>) -> Void

    func makeNSViewController(context: Context) -> MangaGridViewController {
        let controller = MangaGridViewController()
        apply(to: controller)
        return controller
    }

    func updateNSViewController(_ controller: MangaGridViewController, context: Context) {
        apply(to: controller)
    }

    private func apply(to controller: MangaGridViewController) {
        controller.isOrganizerMode = isOrganizerMode
        controller.coverResolver = coverResolver
        controller.onOpen = onOpen
        controller.onReveal = onReveal
        controller.onOpenFolder = onOpenFolder
        controller.onEditTags = onEditTags
        controller.onSetAuthor = onSetAuthor
        controller.onCopyPath = onCopyPath
        controller.onMove = onMove
        controller.onRename = onRename
        controller.onDelete = onDelete
        controller.onWebSearch = onWebSearch
        controller.onSelectionChange = onSelectionChange
        controller.update(books: books, tags: tagsByMangaId)
    }
}
