import SwiftUI

enum Theme {
    enum Radius {
        static let small: CGFloat = 6
        static let standard: CGFloat = 8
        static let card: CGFloat = 12
        static let sheet: CGFloat = 16
        static let pill: CGFloat = 999
    }

    enum Spacing {
        static let tight: CGFloat = 6
        static let standard: CGFloat = 12
        static let generous: CGFloat = 16
        static let section: CGFloat = 24
    }

    enum Card {
        static let width: CGFloat = 186
        static let height: CGFloat = 280
        static let coverHeight: CGFloat = 222
    }
}

extension View {
    func glassCardBackground(cornerRadius: CGFloat = Theme.Radius.card, isSelected: Bool = false) -> some View {
        self
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: cornerRadius))
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .stroke(
                        isSelected ? Color.accentColor : Color.primary.opacity(0.08),
                        lineWidth: isSelected ? 2 : 1
                    )
            )
            .shadow(color: .black.opacity(0.06), radius: 8, x: 0, y: 3)
    }

    func standardSheetFrame(width: CGFloat = 480) -> some View {
        self
            .frame(width: width)
            .padding(Theme.Spacing.generous)
    }
}
