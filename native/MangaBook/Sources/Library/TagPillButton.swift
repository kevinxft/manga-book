import SwiftUI

struct TagPillButton: View {
    let title: String
    let systemImage: String
    let count: Int?
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Image(systemName: systemImage)
                    .font(.caption2)

                Text(title)
                    .font(.caption)
                    .fontWeight(isSelected ? .semibold : .regular)

                if let count {
                    Text("\(count)")
                        .font(.caption2.monospacedDigit())
                        .opacity(0.85)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 0.5)
                        .background(
                            Capsule().fill(isSelected ? Color.white.opacity(0.22) : Color.secondary.opacity(0.12))
                        )
                }
            }
            .foregroundStyle(isSelected ? Color.white : Color.primary)
            .padding(.horizontal, 9)
            .padding(.vertical, 5)
            .contentShape(Capsule())
            .background(
                Capsule().fill(isSelected ? Color.accentColor : Color.secondary.opacity(0.08))
            )
            .overlay(
                Capsule().stroke(isSelected ? Color.clear : Color.primary.opacity(0.08), lineWidth: 0.5)
            )
        }
        .buttonStyle(.plain)
        .animation(.snappy(duration: 0.16), value: isSelected)
    }
}
