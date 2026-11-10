import AppKit

final class MangaCollectionView: NSCollectionView {
    var menuProvider: ((IndexPath?) -> NSMenu?)?
    var singleClickAction: ((IndexPath) -> Void)?
    var onSelectionChanged: (() -> Void)?
    var isOrganizerMode = false

    override func resetCursorRects() {
        super.resetCursorRects()
        addCursorRect(bounds, cursor: .pointingHand)
    }

    override func mouseDown(with event: NSEvent) {
        let point = convert(event.locationInWindow, from: nil)
        let indexPath = indexPathForItem(at: point)

        if isOrganizerMode {
            if let indexPath {
                if selectionIndexPaths.contains(indexPath) {
                    deselectItems(at: [indexPath])
                } else {
                    selectItems(at: [indexPath], scrollPosition: [])
                }
                onSelectionChanged?()
                return
            }
            super.mouseDown(with: event)
            return
        }

        if let indexPath, !event.modifierFlags.contains(.command), !event.modifierFlags.contains(.shift) {
            selectItems(at: [indexPath], scrollPosition: [])
            singleClickAction?(indexPath)
            return
        }

        super.mouseDown(with: event)
    }

    override func menu(for event: NSEvent) -> NSMenu? {
        let point = convert(event.locationInWindow, from: nil)
        let indexPath = indexPathForItem(at: point)
        if let indexPath, !selectionIndexPaths.contains(indexPath) {
            selectItems(at: [indexPath], scrollPosition: [])
        }
        return menuProvider?(indexPath)
    }
}
