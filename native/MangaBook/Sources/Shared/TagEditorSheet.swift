import SwiftUI
import MangaBookCore

struct TagEditorSheet: View {
    let book: MangaBook
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    @State private var selected: Set<String> = []
    @State private var newTags: String = ""
    @State private var saving = false

    private var columns: [GridItem] {
        [GridItem(.adaptive(minimum: 96), spacing: Theme.Spacing.tight, alignment: .leading)]
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.generous) {
            VStack(alignment: .leading, spacing: 4) {
                Text("编辑标签")
                    .font(.title3)
                    .bold()
                Text(book.title)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }

            if model.tags.isEmpty {
                ContentUnavailableView {
                    Label("暂无预设标签", systemImage: "tag")
                } description: {
                    Text("在下方输入新标签（逗号分隔），即可快速创建并关联。")
                }
                .frame(height: 140)
            } else {
                ScrollView {
                    LazyVGrid(columns: columns, alignment: .leading, spacing: Theme.Spacing.tight) {
                        ForEach(model.tags) { tag in
                            TagChipButton(
                                name: tag.name,
                                isSelected: selected.contains(PathUtils.key(tag.name))
                            ) {
                                toggleTag(tag)
                            }
                        }
                    }
                    .padding(2)
                }
                .frame(maxHeight: 180)
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("添加新标签")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                TextField("多个标签用逗号分隔，如：全彩, 奇幻", text: $newTags)
                    .textFieldStyle(.roundedBorder)
            }

            HStack {
                Spacer()
                Button("取消", role: .cancel) { dismiss() }
                    .keyboardShortcut(.cancelAction)

                Button(saving ? "保存中…" : "保存") {
                    save()
                }
                .buttonStyle(.borderedProminent)
                .keyboardShortcut(.defaultAction)
                .disabled(saving)
            }
        }
        .padding(Theme.Spacing.generous)
        .frame(width: 480)
        .onAppear {
            selected = Set(model.tags(for: book).map { PathUtils.key($0.name) })
        }
    }

    private func toggleTag(_ tag: MangaTag) {
        let key = PathUtils.key(tag.name)
        if selected.contains(key) {
            selected.remove(key)
        } else {
            selected.insert(key)
        }
    }

    private func save() {
        saving = true
        var names: [String] = []
        for tag in model.tags where selected.contains(PathUtils.key(tag.name)) {
            names.append(tag.name)
        }
        let extras = newTags
            .split(whereSeparator: { $0 == "," || $0 == "，" || $0 == "\n" })
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        names.append(contentsOf: extras)

        var seen: Set<String> = []
        let unique = names.filter { seen.insert(PathUtils.key($0)).inserted }

        Task {
            await model.setTags(for: book, names: unique)
            saving = false
            dismiss()
        }
    }
}
