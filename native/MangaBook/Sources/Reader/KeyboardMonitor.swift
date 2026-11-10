import AppKit
import SwiftUI

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

    @MainActor
    final class Coordinator {
        var onCommand: ((ReaderKeyCommand) -> Bool)?
        private var monitor: Any?

        func install() {
            guard monitor == nil else { return }
            monitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
                let isEditingText = MainActor.assumeIsolated {
                    NSApp.keyWindow?.firstResponder is NSTextView
                }
                guard !isEditingText, let command = Self.map(event), let self else { return event }
                let handled = MainActor.assumeIsolated {
                    self.onCommand?(command) == true
                }
                return handled ? nil : event
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
            case 49:
                return event.modifierFlags.contains(.shift) ? .previous : .next
            case 123, 115:
                return .previous
            case 124, 119:
                return .next
            case 125, 121:
                return .next
            case 126, 116:
                return .previous
            case 53:
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
