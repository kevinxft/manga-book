import SwiftUI
import MangaBookCore

struct TagFilterBar: View {
    @Environment(AppModel.self) private var model

    @AppStorage("library.tagBarExpanded") private var isExpanded = false
    @State private var showTagPopover = false
    @State private var filterQuery = ""

    private var displayTags: [MangaTag] {
        model.sortedTags
    }

    private var filteredTags: [MangaTag] {
        let q = filterQuery.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !q.isEmpty else { return displayTags }
        return displayTags.filter {
            $0.name.lowercased().contains(q)
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            if isExpanded {
                expandedBarView
            } else {
                collapsedBarView
            }
        }
        .background(.bar)
    }

    // MARK: - Collapsed Single-Line Mode

    private var collapsedBarView: some View {
        HStack(spacing: 0) {
            // Scrollable tag pills with right gradient fade
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    TagPillButton(
                        title: "全部",
                        systemImage: "square.grid.2x2",
                        count: nil,
                        isSelected: model.selectedTag == nil
                    ) {
                        model.selectedTag = nil
                    }

                    ForEach(displayTags) { tag in
                        let count = model.tagCount(tag.name)
                        TagPillButton(
                            title: tag.name,
                            systemImage: nil,
                            count: count,
                            isSelected: model.selectedTag == tag.name,
                            onClear: { model.selectedTag = nil }
                        ) {
                            toggleTag(tag.name)
                        }
                        .contextMenu {
                            Button("删除标签", role: .destructive) {
                                Task { await model.deleteTag(tag) }
                            }
                        }
                    }
                }
                .padding(.horizontal, Theme.Spacing.generous)
                .padding(.vertical, 7)
            }
            .mask(
                HStack(spacing: 0) {
                    Rectangle()
                    LinearGradient(
                        colors: [.black, .black.opacity(0.1), .clear],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    .frame(width: 20)
                }
            )

            Divider()
                .frame(height: 16)
                .padding(.horizontal, 4)

            // Pinned Right Controls
            HStack(spacing: 4) {
                // Popover Button
                Button {
                    showTagPopover.toggle()
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "tag")
                            .font(.system(size: 11))
                        Text("\(model.tags.count)")
                            .font(.caption2.monospacedDigit())
                            .foregroundStyle(.secondary)
                        Image(systemName: "chevron.down")
                            .font(.system(size: 8, weight: .semibold))
                            .foregroundStyle(.tertiary)
                    }
                    .padding(.horizontal, 7)
                    .padding(.vertical, 4.5)
                    .background(Color.secondary.opacity(0.08), in: Capsule())
                }
                .buttonStyle(.plain)
                .popover(isPresented: $showTagPopover, arrowEdge: .bottom) {
                    TagBrowserPopoverView()
                        .environment(model)
                }
                .help("浏览与搜索全部标签")

                // Expand Button
                Button {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                        isExpanded = true
                    }
                } label: {
                    Image(systemName: "chevron.down")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(.secondary)
                        .frame(width: 24, height: 24)
                        .background(Color.secondary.opacity(0.08), in: Circle())
                }
                .buttonStyle(.plain)
                .help("展开多行标签面板")
            }
            .padding(.trailing, 10)
        }
    }

    // MARK: - Expanded Multi-Line Mode

    private var expandedBarView: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Header controls
            HStack {
                HStack(spacing: 6) {
                    Text("标签筛选")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(.secondary)

                    Text("共 \(model.tags.count) 个")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)

                    if let selected = model.selectedTag {
                        HStack(spacing: 3) {
                            Text("已选: #\(selected)")
                                .font(.caption2)
                                .fontWeight(.medium)
                                .foregroundStyle(Color.accentColor)
                            Button {
                                model.selectedTag = nil
                            } label: {
                                Image(systemName: "xmark.circle.fill")
                                    .font(.system(size: 10))
                                    .foregroundStyle(Color.accentColor)
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.horizontal, 6)
                        .padding(.vertical, 1.5)
                        .background(Capsule().fill(Color.accentColor.opacity(0.12)))
                    }
                }

                Spacer()

                // Filter search box
                HStack(spacing: 4) {
                    Image(systemName: "magnifyingglass")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                    TextField("过滤标签…", text: $filterQuery)
                        .textFieldStyle(.plain)
                        .font(.caption)
                    if !filterQuery.isEmpty {
                        Button {
                            filterQuery = ""
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 7)
                .padding(.vertical, 3.5)
                .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 6))
                .frame(width: 140)

                // Collapse Button
                Button {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                        isExpanded = false
                        filterQuery = ""
                    }
                } label: {
                    HStack(spacing: 3) {
                        Text("收起")
                            .font(.caption)
                        Image(systemName: "chevron.up")
                            .font(.system(size: 9, weight: .semibold))
                    }
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3.5)
                    .background(Color.secondary.opacity(0.08), in: Capsule())
                }
                .buttonStyle(.plain)
                .help("收起为单行")
            }
            .padding(.horizontal, 14)
            .padding(.top, 8)

            // Wrapped Tag Flow
            ScrollView(.vertical, showsIndicators: true) {
                FlowLayout(spacing: 6, lineSpacing: 6) {
                    TagPillButton(
                        title: "全部",
                        systemImage: "square.grid.2x2",
                        count: nil,
                        isSelected: model.selectedTag == nil
                    ) {
                        model.selectedTag = nil
                    }

                    ForEach(filteredTags) { tag in
                        let count = model.tagCount(tag.name)
                        TagPillButton(
                            title: tag.name,
                            systemImage: nil,
                            count: count,
                            isSelected: model.selectedTag == tag.name,
                            onClear: { model.selectedTag = nil }
                        ) {
                            toggleTag(tag.name)
                        }
                        .contextMenu {
                            Button("删除标签", role: .destructive) {
                                Task { await model.deleteTag(tag) }
                            }
                        }
                    }
                }
                .padding(.horizontal, 14)
                .padding(.bottom, 10)
            }
            .frame(maxHeight: 180)
        }
    }

    private func toggleTag(_ name: String) {
        if model.selectedTag == name {
            model.selectedTag = nil
        } else {
            model.selectedTag = name
        }
    }
}

// MARK: - Tag Browser Popover

struct TagBrowserPopoverView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    @State private var query = ""
    @State private var sortByCount = true
    @State private var hideZeroCount = false

    private var filteredTags: [MangaTag] {
        var list = model.tags
        if hideZeroCount {
            list = list.filter { model.tagCount($0.name) > 0 }
        }

        let q = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if !q.isEmpty {
            list = list.filter { $0.name.lowercased().contains(q) }
        }

        if sortByCount {
            list.sort {
                let c1 = model.tagCount($0.name)
                let c2 = model.tagCount($1.name)
                if c1 != c2 { return c1 > c2 }
                return $0.name.localizedStandardCompare($1.name) == .orderedAscending
            }
        } else {
            list.sort {
                $0.name.localizedStandardCompare($1.name) == .orderedAscending
            }
        }
        return list
    }

    var body: some View {
        VStack(spacing: 0) {
            // Search & Sort bar
            VStack(spacing: 8) {
                HStack(spacing: 6) {
                    Image(systemName: "magnifyingglass")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                    TextField("搜索全部标签…", text: $query)
                        .textFieldStyle(.plain)
                        .font(.callout)
                    if !query.isEmpty {
                        Button { query = "" } label: {
                            Image(systemName: "xmark.circle.fill")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 5)
                .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 6))

                HStack {
                    Picker("排序", selection: $sortByCount) {
                        Text("按漫画数").tag(true)
                        Text("按字母").tag(false)
                    }
                    .pickerStyle(.segmented)
                    .controlSize(.small)

                    Spacer()

                    Toggle("隐藏空标签", isOn: $hideZeroCount)
                        .font(.caption2)
                        .controlSize(.small)
                }
            }
            .padding(10)
            .background(.bar)

            Divider()

            // Tag Cloud
            if filteredTags.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "tag.slash")
                        .font(.title3)
                        .foregroundStyle(.tertiary)
                    Text("未找到匹配标签")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .frame(height: 180)
            } else {
                ScrollView(.vertical) {
                    FlowLayout(spacing: 6, lineSpacing: 6) {
                        TagPillButton(
                            title: "全部",
                            systemImage: "square.grid.2x2",
                            count: nil,
                            isSelected: model.selectedTag == nil
                        ) {
                            model.selectedTag = nil
                            dismiss()
                        }

                        ForEach(filteredTags) { tag in
                            let count = model.tagCount(tag.name)
                            TagPillButton(
                                title: tag.name,
                                systemImage: nil,
                                count: count,
                                isSelected: model.selectedTag == tag.name,
                                onClear: {
                                    model.selectedTag = nil
                                    dismiss()
                                }
                            ) {
                                if model.selectedTag == tag.name {
                                    model.selectedTag = nil
                                } else {
                                    model.selectedTag = tag.name
                                }
                                dismiss()
                            }
                            .contextMenu {
                                Button("删除标签", role: .destructive) {
                                    Task { await model.deleteTag(tag) }
                                }
                            }
                        }
                    }
                    .padding(12)
                }
                .frame(maxHeight: 280)
            }

            Divider()

            // Footer
            HStack {
                Text("共 \(filteredTags.count) 个标签")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Spacer()
                if model.selectedTag != nil {
                    Button("清除筛选") {
                        model.selectedTag = nil
                        dismiss()
                    }
                    .font(.caption2)
                    .controlSize(.small)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(.bar)
        }
        .frame(width: 360)
    }
}

// MARK: - FlowLayout (Wrapping Chip Layout)

struct FlowLayout: Layout {
    var spacing: CGFloat = 6
    var lineSpacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        var currentX: CGFloat = 0
        var currentY: CGFloat = 0
        var lineHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if currentX + size.width > width && currentX > 0 {
                currentX = 0
                currentY += lineHeight + lineSpacing
                lineHeight = 0
            }
            lineHeight = max(lineHeight, size.height)
            currentX += size.width + spacing
        }
        return CGSize(width: width, height: currentY + lineHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var currentX: CGFloat = bounds.minX
        var currentY: CGFloat = bounds.minY
        var lineHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if currentX + size.width > bounds.maxX && currentX > bounds.minX {
                currentX = bounds.minX
                currentY += lineHeight + lineSpacing
                lineHeight = 0
            }
            subview.place(at: CGPoint(x: currentX, y: currentY), proposal: ProposedViewSize(size))
            lineHeight = max(lineHeight, size.height)
            currentX += size.width + spacing
        }
    }
}
