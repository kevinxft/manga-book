import SwiftUI
import MangaBookCore

struct RootView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model

        Group {
            if let error = model.startupError {
                StartupErrorView(message: error)
            } else if model.root == nil {
                OnboardingView()
            } else {
                ZStack {
                    NavigationSplitView {
                        SidebarView()
                            .navigationSplitViewColumnWidth(min: 220, ideal: 260, max: 340)
                    } detail: {
                        switch model.section {
                        case .library:
                            LibraryView()
                        case .organizer:
                            OrganizerView()
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
}
