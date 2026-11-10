import SwiftUI
import MangaBookCore

struct AuthorAliasesSheet: View {
    @Environment(AppModel.self) private var model
    @Binding var isPresented: Bool

    @State private var newAlias = ""
    @State private var newCanonical = ""

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.generous) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("作者别名管理")
                        .font(.title3)
                        .bold()
                    Text("别名可将旧作者名或异名重定向到规范作者名。")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Button("完成") { isPresented = false }
                    .keyboardShortcut(.defaultAction)
            }

            if model.aliases.isEmpty {
                ContentUnavailableView {
                    Label("暂无别名", systemImage: "arrow.left.arrow.right")
                } description: {
                    Text("可在下方添加别名，自动将同作者的不同写法归并。")
                }
                .frame(height: 240)
            } else {
                List {
                    ForEach(model.aliases) { alias in
                        HStack(spacing: Theme.Spacing.standard) {
                            Text(alias.alias)
                                .font(.body)
                                .lineLimit(1)
                            Image(systemName: "arrow.right")
                                .font(.caption)
                                .foregroundStyle(.tertiary)
                            Text(alias.canonicalName)
                                .font(.body)
                                .lineLimit(1)
                            Spacer()
                            Button(role: .destructive) {
                                Task { await model.removeAlias(alias.alias) }
                            } label: {
                                Image(systemName: "trash")
                                    .foregroundStyle(.secondary)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .listStyle(.inset)
                .frame(height: 260)
            }

            HStack(spacing: Theme.Spacing.standard) {
                TextField("别名", text: $newAlias)
                    .textFieldStyle(.roundedBorder)
                Image(systemName: "arrow.right")
                    .foregroundStyle(.tertiary)
                TextField("规范作者名", text: $newCanonical)
                    .textFieldStyle(.roundedBorder)

                Button("添加") {
                    let alias = newAlias.trimmingCharacters(in: .whitespacesAndNewlines)
                    let canonical = newCanonical.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !alias.isEmpty, !canonical.isEmpty else { return }
                    Task {
                        await model.upsertAlias(alias: alias, canonicalName: canonical)
                        newAlias = ""
                        newCanonical = ""
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(
                    newAlias.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
                    newCanonical.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                )
            }
        }
        .padding(Theme.Spacing.generous)
        .frame(width: 540, height: 460)
    }
}
