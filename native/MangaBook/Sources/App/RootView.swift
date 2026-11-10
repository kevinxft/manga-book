import SwiftUI

struct RootView: View {
    @Environment(AppModel.self) private var model
    @Bindable private var downloadManager = DownloadManager.shared

    var body: some View {
        @Bindable var model = model

        Group {
            if let error = model.startupError {
                StartupErrorView(message: error)
            } else if model.root == nil {
                OnboardingView()
            } else {
                ZStack {
                    Group {
                        switch model.section {
                        case .library:
                            LibraryShellView()
                        case .organizer:
                            NavigationStack {
                                OrganizerView()
                            }
                        }
                    }
                    .allowsHitTesting(model.readingBook == nil)

                    if let book = model.readingBook {
                        ReaderView(book: book)
                            .transition(.opacity)
                            .zIndex(1)
                    }
                }
            }
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button(
                    model.section == .library ? "漫画整理" : "返回漫画库",
                    systemImage: model.section == .library ? "square.grid.2x2" : "chevron.left"
                ) {
                    model.section = model.section == .library ? .organizer : .library
                }
                .help(model.section == .organizer ? "返回漫画库" : "漫画整理")
                .disabled(model.root == nil || model.readingBook != nil)
            }

            ToolbarItem(placement: .primaryAction) {
                downloadCenterButton
            }

            ToolbarItem(placement: .primaryAction) {
                Button("设置", systemImage: "gearshape") {
                    model.showSettings = true
                }
                .help("设置（⌘,）")
            }
        }
        .task {
            await model.bootstrap()
        }
        .alert(
            "出错了",
            isPresented: Binding(
                get: { model.errorMessage != nil },
                set: { if !$0 { model.errorMessage = nil } }
            )
        ) {
            Button("好", role: .cancel) { model.errorMessage = nil }
        } message: {
            Text(model.errorMessage ?? "")
        }
        .sheet(item: $model.tagEditorTarget) { book in
            TagEditorSheet(book: book)
                .environment(model)
        }
        .sheet(item: $model.setAuthorRequest) { request in
            SetAuthorSheet(mangaIDs: request.mangaIDs)
                .environment(model)
        }
        .sheet(item: $model.moveRequest) { request in
            MoveDestinationSheet(request: request)
                .environment(model)
        }
        .sheet(item: $model.renameTarget) { book in
            RenameMangaSheet(book: book)
                .environment(model)
        }
        .sheet(isPresented: $model.showSettings) {
            SettingsView()
                .environment(model)
        }
        .sheet(isPresented: Bindable(DownloadManager.shared).showManualInputSheet) {
            ManualDownloadSheet()
                .environment(model)
        }
        .confirmationDialog(
            "删除所选漫画？",
            isPresented: Binding(
                get: { model.deleteRequest != nil },
                set: { if !$0 { model.deleteRequest = nil } }
            )
        ) {
            Button("移到废纸篓并删除记录", role: .destructive) {
                if let request = model.deleteRequest {
                    Task { await model.deleteMangas(ids: request.mangaIDs) }
                }
            }
        } message: {
            Text("漫画目录会被移到废纸篓，同时删除数据库记录。")
        }
    }

    private var downloadCenterButton: some View {
        Button {
            downloadManager.showDownloadCenter.toggle()
        } label: {
            Label {
                Text("下载中心")
            } icon: {
                ZStack(alignment: .topTrailing) {
                    Image(systemName: downloadManager.isDownloading ? "arrow.down.circle.fill" : "arrow.down.circle")
                        .foregroundStyle(downloadManager.isDownloading ? Color.accentColor : Color.primary)
                    if downloadManager.activeCount > 0 {
                        Circle()
                            .fill(Color.red)
                            .frame(width: 7, height: 7)
                            .offset(x: 2, y: -2)
                    }
                }
            }
        }
        .help("下载中心（⌘J）")
        .popover(
            isPresented: $downloadManager.showDownloadCenter,
            attachmentAnchor: .rect(.bounds),
            arrowEdge: .top
        ) {
            DownloadCenterView()
                .environment(model)
        }
    }
}
