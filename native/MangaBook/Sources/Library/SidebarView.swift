import SwiftUI
import MangaBookCore

struct SidebarView: View {
    @Environment(AppModel.self) private var model
    @State private var authorSearch = ""

    private var filteredAuthors: [TargetDirectorySummary] {
        let query = authorSearch.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !query.isEmpty else { return model.authors }
        return model.authors.filter {
            PathUtils.displayName(for: $0.directory).lowercased().contains(query)
        }
    }

    var body: some View {
        @Bindable var model = model

        VStack(spacing: 0) {
            // 1. Pinned Header: Library Info & Menu
            SidebarHeaderView()
            Divider()

            // 2. Pinned Top Section: Core Categories (Never scrolls away!)
            VStack(alignment: .leading, spacing: 2) {
                Text("漫画库")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(.tertiary)
                    .padding(.horizontal, Theme.Spacing.standard)
                    .padding(.top, Theme.Spacing.tight)
                    .padding(.bottom, 2)

                PrimaryNavItem(
                    title: "全部漫画",
                    systemImage: "books.vertical.fill",
                    count: model.allBooks.count,
                    isSelected: model.selection == .all && model.section == .library
                ) {
                    model.selection = .all
                    model.section = .library
                }

                PrimaryNavItem(
                    title: "作者",
                    systemImage: "person.2.fill",
                    count: model.authorsCount,
                    isSelected: model.selection == .authors && model.section == .library
                ) {
                    model.selection = .authors
                    model.section = .library
                }

                PrimaryNavItem(
                    title: "未分类",
                    systemImage: "tray.fill",
                    count: model.unsortedCount,
                    isSelected: model.selection == .unsorted && model.section == .library
                ) {
                    model.selection = .unsorted
                    model.section = .library
                }
            }
            .padding(.horizontal, Theme.Spacing.tight)
            .padding(.bottom, Theme.Spacing.tight)

            Divider()

            // 3. Middle Scrollable Section: Author Directories
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 6) {
                    Text("作者目录")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(.tertiary)

                    Text("\(model.authors.count)")
                        .font(.caption2.monospacedDigit())
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 1)
                        .background(Capsule().fill(Color.secondary.opacity(0.12)))

                    Spacer()
                }
                .padding(.horizontal, Theme.Spacing.generous)
                .padding(.top, Theme.Spacing.standard)
                .padding(.bottom, 6)

                if model.authors.count > 12 {
                    HStack(spacing: 4) {
                        Image(systemName: "magnifyingglass")
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                        TextField("过滤作者…", text: $authorSearch)
                            .textFieldStyle(.plain)
                            .font(.caption)
                        if !authorSearch.isEmpty {
                            Button {
                                authorSearch = ""
                            } label: {
                                Image(systemName: "xmark.circle.fill")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: Theme.Radius.small))
                    .padding(.horizontal, Theme.Spacing.standard)
                    .padding(.bottom, 6)
                }

                List(selection: $model.selection) {
                    ForEach(filteredAuthors) { author in
                        AuthorSidebarRow(author: author)
                            .tag(AppModel.SidebarItem.author(author.directory))
                            .contextMenu {
                                Button("在整理中心管理") { model.section = .organizer }
                                Button("在 Finder 中显示") {
                                    NSWorkspace.shared.activateFileViewerSelecting([
                                        URL(fileURLWithPath: author.directory, isDirectory: true)
                                    ])
                                }
                            }
                    }
                }
                .listStyle(.sidebar)
                .onChange(of: model.selection) { _, _ in
                    model.section = .library
                }
            }

        }
    }
}
