import SwiftUI

struct SidebarHeaderView: View {
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
