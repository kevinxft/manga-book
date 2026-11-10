import SwiftUI

struct OrganizerMoveActionView: View {
    let selectedMangaCount: Int
    let selectedAuthorName: String?
    let unsortedPath: String?
    let isMoving: Bool
    let onMoveToAuthor: () -> Void
    let onMoveToUnsorted: (String) -> Void

    private var canMoveToAuthor: Bool {
        selectedMangaCount > 0 && selectedAuthorName != nil && !isMoving
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.standard) {
            primaryAction

            if let unsortedPath, selectedMangaCount > 0 {
                Button {
                    onMoveToUnsorted(unsortedPath)
                } label: {
                    Label("移至未分类", systemImage: "tray.and.arrow.down")
                        .font(.callout)
                }
                .buttonStyle(.plain)
                .foregroundStyle(.secondary)
                .disabled(isMoving)
            }
        }
        .padding(.horizontal, Theme.Spacing.generous)
        .padding(.vertical, Theme.Spacing.standard)
    }

    @ViewBuilder
    private var primaryAction: some View {
        if isMoving {
            statusRow(
                text: "正在移动漫画…",
                systemImage: "arrow.triangle.2.circlepath",
                showsProgress: true
            )
        } else if let selectedAuthorName, selectedMangaCount > 0 {
            Button(action: onMoveToAuthor) {
                Label(
                    "移动 \(selectedMangaCount) 本到「\(selectedAuthorName)」",
                    systemImage: "arrow.right"
                )
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.regular)
            .disabled(!canMoveToAuthor)
        } else if selectedMangaCount > 0 {
            statusRow(
                text: "已选择 \(selectedMangaCount) 本，请在下方选择目标作者",
                systemImage: "person.crop.circle"
            )
        } else {
            statusRow(
                text: "选择左侧漫画后，可批量移动到作者目录",
                systemImage: "cursorarrow.click"
            )
        }
    }

    private func statusRow(
        text: String,
        systemImage: String,
        showsProgress: Bool = false
    ) -> some View {
        HStack(spacing: Theme.Spacing.tight) {
            if showsProgress {
                ProgressView()
                    .controlSize(.small)
            } else {
                Image(systemName: systemImage)
                    .foregroundStyle(.secondary)
            }

            Text(text)
                .font(.callout)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Theme.Spacing.standard)
        .padding(.vertical, 10)
        .background(.quaternary.opacity(0.55), in: RoundedRectangle(cornerRadius: Theme.Radius.standard))
    }
}
