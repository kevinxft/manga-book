import SwiftUI

struct TagFilterBar: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Theme.Spacing.tight) {
                TagPillButton(
                    title: "全部",
                    systemImage: "square.grid.2x2",
                    count: nil,
                    isSelected: model.selectedTag == nil
                ) {
                    model.selectedTag = nil
                }

                ForEach(model.tags) { tag in
                    TagPillButton(
                        title: tag.name,
                        systemImage: "tag.fill",
                        count: model.tagCount(tag.name),
                        isSelected: model.selectedTag == tag.name
                    ) {
                        if model.selectedTag == tag.name {
                            model.selectedTag = nil
                        } else {
                            model.selectedTag = tag.name
                        }
                    }
                    .contextMenu {
                        Button("删除标签", role: .destructive) {
                            Task { await model.deleteTag(tag) }
                        }
                    }
                }

                if model.selectedTag != nil {
                    Button {
                        model.selectedTag = nil
                    } label: {
                        HStack(spacing: 3) {
                            Image(systemName: "xmark.circle.fill")
                                .font(.caption)
                            Text("清除筛选")
                                .font(.caption)
                        }
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, Theme.Spacing.generous)
            .padding(.vertical, 8)
        }
        .background(.bar)
    }
}
