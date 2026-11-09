import SwiftUI

struct OnboardingView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        ContentUnavailableView {
            Image(systemName: "books.vertical.fill")
                .symbolRenderingMode(.hierarchical)
                .foregroundStyle(Color.accentColor)
                .font(.system(size: 64))
        } description: {
            VStack(spacing: Theme.Spacing.tight) {
                Text("欢迎使用漫书")
                    .font(.title2)
                    .bold()
                Text("选择现有的 .mangalibrary 目录，或选择一个新目录开始整理。")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: 420)
            }
        } actions: {
            VStack(spacing: Theme.Spacing.standard) {
                Button("选择漫画库…", systemImage: "folder.badge.plus") {
                    model.chooseLibraryRoot()
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .keyboardShortcut(.defaultAction)

                Text("数据库会复用现有元数据，不会重新扫描或丢失阅读进度。")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
            .padding(.top, Theme.Spacing.standard)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.background)
    }
}
