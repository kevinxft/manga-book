import SwiftUI
import MangaBookCore

struct MoveDestinationSheet: View {
    let request: AppModel.SelectionRequest
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    @State private var newAuthorName = ""

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.generous) {
            VStack(alignment: .leading, spacing: 4) {
                Text("移动到")
                    .font(.title3)
                    .bold()
                Text("已选 \(request.mangaIDs.count) 本漫画")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            List {
                if let unsorted = model.unsortedRootPath {
                    Button {
                        move(to: unsorted)
                    } label: {
                        HStack(spacing: Theme.Spacing.standard) {
                            Image(systemName: "tray.fill")
                                .foregroundStyle(Color.accentColor)
                                .frame(width: 20)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("未分类")
                                    .font(.body)
                                Text(unsorted)
                                    .font(.caption)
                                    .foregroundStyle(.tertiary)
                                    .lineLimit(1)
                                    .truncationMode(.middle)
                            }
                            Spacer()
                        }
                    }
                    .buttonStyle(.plain)
                }

                Section("作者目录") {
                    ForEach(model.authors) { author in
                        Button {
                            move(to: author.directory)
                        } label: {
                            HStack(spacing: Theme.Spacing.standard) {
                                Image(systemName: "folder.fill")
                                    .foregroundStyle(.secondary)
                                    .frame(width: 20)
                                Text(PathUtils.displayName(for: author.directory))
                                    .font(.body)
                                Spacer()
                                Text("\(author.mangaCount)")
                                    .font(.caption.monospacedDigit())
                                    .foregroundStyle(.secondary)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(Capsule().fill(Color.secondary.opacity(0.12)))
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .listStyle(.inset)
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.standard))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.Radius.standard)
                    .stroke(Color.separatorColor, lineWidth: 0.5)
            )
            .frame(height: 320)

            HStack(spacing: Theme.Spacing.standard) {
                TextField("新建作者目录并移动…", text: $newAuthorName)
                    .textFieldStyle(.roundedBorder)

                Button("新建并移动") {
                    let name = newAuthorName.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !name.isEmpty else { return }
                    Task {
                        if let path = await model.createAuthorDirectory(name: name) {
                            await model.moveMangas(ids: request.mangaIDs, to: path)
                        }
                        dismiss()
                    }
                }
                .disabled(newAuthorName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }

            HStack {
                Spacer()
                Button("取消", role: .cancel) { dismiss() }
                    .keyboardShortcut(.cancelAction)
            }
        }
        .padding(Theme.Spacing.generous)
        .frame(width: 480)
    }

    private func move(to directory: String) {
        Task {
            await model.moveMangas(ids: request.mangaIDs, to: directory)
            dismiss()
        }
    }
}

private extension Color {
    static let separatorColor = Color(nsColor: .separatorColor)
}
