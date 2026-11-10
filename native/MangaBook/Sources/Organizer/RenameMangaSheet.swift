import SwiftUI
import MangaBookCore

struct RenameMangaSheet: View {
    let book: MangaBook
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    @State private var title: String = ""

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.generous) {
            VStack(alignment: .leading, spacing: 4) {
                Text("重命名漫画")
                    .font(.title3)
                    .bold()
                Text(book.folderPath)
                    .font(.caption)
                    .foregroundStyle(.tertiary)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }

            TextField("漫画名称", text: $title)
                .textFieldStyle(.roundedBorder)

            HStack {
                Spacer()
                Button("取消", role: .cancel) { dismiss() }
                    .keyboardShortcut(.cancelAction)

                Button("重命名") {
                    let value = title.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !value.isEmpty else { return }
                    Task {
                        await model.rename(book, to: value)
                        dismiss()
                    }
                }
                .buttonStyle(.borderedProminent)
                .keyboardShortcut(.defaultAction)
                .disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
        .padding(Theme.Spacing.generous)
        .frame(width: 460)
        .onAppear {
            title = book.title
        }
    }
}
