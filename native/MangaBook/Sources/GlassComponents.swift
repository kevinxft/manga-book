import SwiftUI

enum LiquidGlass {
    @ViewBuilder
    static func container<Content: View>(spacing: CGFloat = 8, @ViewBuilder content: () -> Content) -> some View {
        if #available(macOS 26.0, iOS 26.0, *) {
            GlassEffectContainer(spacing: spacing) {
                content()
            }
        } else {
            content()
        }
    }
}

@available(macOS 26.0, iOS 26.0, *)
private func resolveGlassStyle(interactive: Bool, tint: Color?) -> Glass {
    var glass: Glass = .regular
    if let tint {
        glass = glass.tint(tint)
    }
    if interactive {
        glass = glass.interactive()
    }
    return glass
}

extension View {
    @ViewBuilder
    func applyLiquidGlass<S: Shape>(
        in shape: S,
        interactive: Bool = false,
        tint: Color? = nil
    ) -> some View {
        if #available(macOS 26.0, iOS 26.0, *) {
            self.glassEffect(resolveGlassStyle(interactive: interactive, tint: tint), in: shape)
        } else {
            self.background(
                shape.fill(tint != nil ? tint!.opacity(0.18) : Color.white.opacity(0.08))
            )
            .background(.ultraThinMaterial, in: shape)
            .overlay(
                shape.stroke(
                    tint != nil ? tint!.opacity(0.6) : Color.white.opacity(0.18),
                    lineWidth: 0.5
                )
            )
        }
    }

    @ViewBuilder
    func liquidGlassCapsule(
        interactive: Bool = false,
        tint: Color? = nil
    ) -> some View {
        applyLiquidGlass(in: .capsule, interactive: interactive, tint: tint)
    }

    @ViewBuilder
    func liquidGlassCard(
        cornerRadius: CGFloat = Theme.Radius.card,
        interactive: Bool = false,
        tint: Color? = nil
    ) -> some View {
        applyLiquidGlass(in: .rect(cornerRadius: cornerRadius), interactive: interactive, tint: tint)
    }
}
