import AppKit
import SwiftUI

enum ReaderKeyCommand {
    case next
    case previous
    case escape
    case toggleWidth
}

struct KeyboardMonitor: NSViewRepresentable {
    var onCommand: (ReaderKeyCommand) -> Bool

    func makeNSView(context: Context) -> NSView {
        context.coordinator.onCommand = onCommand
        context.coordinator.install()
        return NSView(frame: .zero)
    }

    func updateNSView(_ nsView: NSView, context: Context) {
        context.coordinator.onCommand = onCommand
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    static func dismantleNSView(_ nsView: NSView, coordinator: Coordinator) {
        coordinator.uninstall()
    }

    final class Coordinator {
        var onCommand: ((ReaderKeyCommand) -> Bool)?
        private var monitor: Any?

        func install() {
            guard monitor == nil else { return }
            monitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
                guard let self else { return event }
                if let responder = NSApp.keyWindow?.firstResponder, responder is NSTextView {
                    return event
                }
                guard let command = Self.map(event) else { return event }
                return self.onCommand?(command) == true ? nil : event
            }
        }

        func uninstall() {
            if let monitor {
                NSEvent.removeMonitor(monitor)
            }
            monitor = nil
        }

        private static func map(_ event: NSEvent) -> ReaderKeyCommand? {
            let modifiers = event.modifierFlags.intersection([.command, .option, .control])
            guard modifiers.isEmpty else { return nil }

            switch event.keyCode {
            case 49: // space
                return event.modifierFlags.contains(.shift) ? .previous : .next
            case 123, 115: // left, home
                return .previous
            case 124, 119: // right, end
                return .next
            case 125, 121: // down, page down
                return .next
            case 126, 116: // up, page up
                return .previous
            case 53: // escape
                return .escape
            default:
                break
            }

            switch event.charactersIgnoringModifiers?.lowercased() {
            case "a", "w":
                return .previous
            case "d", "s":
                return .next
            case "f":
                return .toggleWidth
            default:
                return nil
            }
        }
    }
}

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
