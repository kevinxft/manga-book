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
                    item: .all,
                    title: "全部漫画",
                    systemImage: "books.vertical.fill",
                    count: model.allBooks.count,
                    isSelected: model.selection == .all && model.section == .library
                ) {
                    model.selection = .all
                    model.section = .library
                }

                PrimaryNavItem(
                    item: .authors,
                    title: "作者",
                    systemImage: "person.2.fill",
                    count: model.authorsCount,
                    isSelected: model.selection == .authors && model.section == .library
                ) {
                    model.selection = .authors
                    model.section = .library
                }

                PrimaryNavItem(
                    item: .unsorted,
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
                        VoiceSearchButton { text in
                            authorSearch = text
                        }
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

            Divider()

            // 4. Pinned Bottom Section: Tools & Settings
            SidebarToolsFooter()
        }
    }
}

private struct PrimaryNavItem: View {
    let item: AppModel.SidebarItem
    let title: String
    let systemImage: String
    let count: Int
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Theme.Spacing.standard) {
                Image(systemName: systemImage)
                    .symbolRenderingMode(.hierarchical)
                    .frame(width: 18)
                    .foregroundStyle(isSelected ? Color.accentColor : Color.secondary)

                Text(title)
                    .font(.body)
                    .fontWeight(isSelected ? .semibold : .regular)
                    .foregroundStyle(isSelected ? Color.accentColor : Color.primary)

                Spacer(minLength: 4)

                Text("\(count)")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(isSelected ? Color.accentColor.opacity(0.85) : Color.secondary)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(
                        Capsule().fill(isSelected ? Color.accentColor.opacity(0.18) : Color.secondary.opacity(0.10))
                    )
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .contentShape(Rectangle())
            .background(
                RoundedRectangle(cornerRadius: Theme.Radius.small)
                    .fill(isSelected ? Color.accentColor.opacity(0.12) : Color.clear)
            )
        }
        .buttonStyle(.plain)
    }
}

private struct AuthorSidebarRow: View {
    let author: TargetDirectorySummary

    var body: some View {
        Label {
            Text(PathUtils.displayName(for: author.directory))
                .lineLimit(1)
        } icon: {
            Image(systemName: "folder.fill")
                .symbolRenderingMode(.hierarchical)
        }
        .badge(author.mangaCount)
    }
}

private struct SidebarHeaderView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        HStack(alignment: .center, spacing: Theme.Spacing.standard) {
            ZStack {
                RoundedRectangle(cornerRadius: Theme.Radius.small)
                    .fill(Color.accentColor.gradient)
                    .frame(width: 32, height: 32)
                Image(systemName: "books.vertical.fill")
                    .font(.system(size: 16))
                    .foregroundStyle(.white)
            }
            .shadow(color: Color.accentColor.opacity(0.3), radius: 4, x: 0, y: 2)

            VStack(alignment: .leading, spacing: 2) {
                Text(model.root?.displayName ?? "漫画库")
                    .font(.headline)
                    .lineLimit(1)
                Text(model.root?.path ?? "")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }

            Spacer(minLength: 4)

            Menu {
                Button("同步漫画库", systemImage: "arrow.clockwise") {
                    Task { await model.sync() }
                }
                .disabled(model.isScanning)

                Button("导入漫画到未分类…", systemImage: "square.and.arrow.down") {
                    guard let unsorted = model.unsortedRootPath else { return }
                    Task { await model.importMangas(into: unsorted) }
                }

                Divider()

                Button("在 Finder 中显示", systemImage: "folder") {
                    model.revealLibraryInFinder()
                }

                Button("应用文件夹图标", systemImage: "app.badge") {
                    guard let root = model.root else { return }
                    model.applyFolderIcon(to: root.path)
                }

                Button("更换漫画库…", systemImage: "arrow.triangle.swap") {
                    model.chooseLibraryRoot()
                }

                Divider()

                Button("设置…", systemImage: "gearshape") {
                    model.showSettings = true
                }
            } label: {
                Image(systemName: "ellipsis.circle")
                    .font(.system(size: 15))
                    .foregroundStyle(.secondary)
            }
            .menuStyle(.borderlessButton)
            .menuIndicator(.hidden)
            .fixedSize()
        }
        .padding(.horizontal, Theme.Spacing.generous)
        .padding(.vertical, Theme.Spacing.standard)
    }
}

private struct SidebarToolsFooter: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        LiquidGlass.container(spacing: 4) {
            VStack(spacing: 4) {
                ToolButton(
                    title: "漫画整理",
                    systemImage: "square.grid.2x2.fill",
                    isActive: model.section == .organizer
                ) {
                    model.section = .organizer
                }

                ToolButton(
                    title: "设置",
                    systemImage: "gearshape.fill",
                    isActive: false
                ) {
                    model.showSettings = true
                }
            }
            .padding(.horizontal, Theme.Spacing.standard)
            .padding(.vertical, Theme.Spacing.tight)
        }
        .background(.bar)
    }
}

private struct ToolButton: View {
    let title: String
    let systemImage: String
    let isActive: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Theme.Spacing.tight) {
                Image(systemName: systemImage)
                    .symbolRenderingMode(.hierarchical)
                    .frame(width: 18)
                    .foregroundStyle(isActive ? Color.accentColor : Color.primary)
                Text(title)
                    .font(.subheadline)
                    .fontWeight(isActive ? .semibold : .regular)
                Spacer(minLength: 4)
                if isActive {
                    Image(systemName: "checkmark")
                        .font(.caption)
                        .foregroundStyle(Color.accentColor)
                }
            }
            .padding(.horizontal, Theme.Spacing.standard)
            .padding(.vertical, 7)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .liquidGlassCard(
            cornerRadius: Theme.Radius.small,
            interactive: true,
            tint: isActive ? Color.accentColor : nil
        )
    }
}
