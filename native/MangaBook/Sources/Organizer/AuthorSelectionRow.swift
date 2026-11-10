import MangaBookCore
import SwiftUI

struct AuthorSelectionRow: View {
    let author: TargetDirectorySummary
    let isTarget: Bool

    var body: some View {
        HStack(spacing: Theme.Spacing.standard) {
            Image(systemName: isTarget ? "checkmark.circle.fill" : "folder")
                .symbolRenderingMode(.hierarchical)
                .foregroundStyle(isTarget ? Color.accentColor : Color.secondary)
                .frame(width: 18)

            Text(PathUtils.displayName(for: author.directory))
                .font(.body)
                .lineLimit(1)

            Spacer()

            Text("\(author.mangaCount) 本")
                .font(.caption.monospacedDigit())
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 7)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            isTarget ? Color.accentColor.opacity(0.10) : Color.clear,
            in: RoundedRectangle(cornerRadius: Theme.Radius.small)
        )
        .contentShape(Rectangle())
        .accessibilityAddTraits(isTarget ? .isSelected : [])
    }
}
