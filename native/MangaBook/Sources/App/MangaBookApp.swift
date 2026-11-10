import SwiftUI

@main
struct MangaBookApp: App {
    @State private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .frame(minWidth: 980, minHeight: 640)
                .onOpenURL { url in
                    model.handleIncomingURL(url)
                }
        }
        .defaultSize(width: 1320, height: 860)
        .windowToolbarStyle(.unified(showsTitle: true))
        .commands {
            CommandGroup(replacing: .appSettings) {
                Button("设置…") { model.showSettings = true }
                    .keyboardShortcut(",", modifiers: .command)
            }

            CommandGroup(after: .newItem) {
                Button("下载在线漫画…") {
                    DownloadManager.shared.showManualInputSheet = true
                }
                .keyboardShortcut("d", modifiers: .command)

                Button("下载中心") {
                    DownloadManager.shared.showDownloadCenter = true
                }
                .keyboardShortcut("j", modifiers: .command)

                Divider()

                Button("同步漫画库") {
                    Task { await model.sync() }
                }
                .keyboardShortcut("r", modifiers: .command)
                .disabled(model.isScanning)

                Divider()

                Button("选择漫画库…") {
                    model.chooseLibraryRoot()
                }
                .keyboardShortcut("o", modifiers: [.command, .shift])
            }

            CommandMenu("漫画") {
                Button("在 Finder 中显示") {
                    if let book = model.visibleBooks.first(where: { model.selectedIDs.contains($0.id) }) {
                        model.reveal(book)
                    }
                }
                .keyboardShortcut("f", modifiers: [.command, .shift])
                .disabled(model.selectedIDs.isEmpty)

                Button("编辑标签…") {
                    if let book = model.visibleBooks.first(where: { model.selectedIDs.contains($0.id) }) {
                        model.editTags(for: book)
                    }
                }
                .disabled(model.selectedIDs.count != 1)

                Button("移动到…") {
                    model.requestMove(ids: Array(model.selectedIDs))
                }
                .disabled(model.selectedIDs.isEmpty)

                Button("重命名…") {
                    if model.selectedIDs.count == 1,
                       let book = model.visibleBooks.first(where: { model.selectedIDs.contains($0.id) }) {
                        model.renameTarget = book
                    }
                }
                .disabled(model.selectedIDs.count != 1)

                Button("删除所选…") {
                    model.requestDelete(ids: Array(model.selectedIDs))
                }
                .disabled(model.selectedIDs.isEmpty)
            }
        }

        MenuBarExtra {
            MenuBarView()
                .environment(model)
        } label: {
            MenuBarIconView()
        }
        .menuBarExtraStyle(.window)
    }
}
