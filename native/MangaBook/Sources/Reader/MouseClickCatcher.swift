import AppKit
import SwiftUI

struct MouseClickCatcher: NSViewRepresentable {
    var onLeftClick: () -> Void
    var onRightClick: () -> Void

    func makeNSView(context: Context) -> NSView {
        let view = ClickView()
        view.onLeftClick = onLeftClick
        view.onRightClick = onRightClick
        return view
    }

    func updateNSView(_ nsView: NSView, context: Context) {
        guard let view = nsView as? ClickView else { return }
        view.onLeftClick = onLeftClick
        view.onRightClick = onRightClick
    }

    final class ClickView: NSView {
        var onLeftClick: (() -> Void)?
        var onRightClick: (() -> Void)?

        override func mouseDown(with event: NSEvent) {
            onLeftClick?()
        }

        override func rightMouseDown(with event: NSEvent) {
            onRightClick?()
        }

        override func acceptsFirstMouse(for event: NSEvent?) -> Bool {
            true
        }
    }
}
