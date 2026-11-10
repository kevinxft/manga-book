import SwiftUI
import MangaBookCore

struct MergeAuthorSheet: View {
    let mergeTargets: [String]
    @Binding var isPresented: Bool
    var onMerge: (String) -> Void

    @State private var targetName = ""

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.generous) {
            VStack(alignment: .leading, spacing: 4) {
                Text("合并作者目录")
                    .font(.title3)
                    .bold()
                Text("将 \(mergeTargets.count) 个作者目录下的漫画移动到同一个目录。")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            ScrollView {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(mergeTargets, id: \.self) { path in
                        HStack(spacing: Theme.Spacing.tight) {
                            Image(systemName: "folder.fill")
                                .foregroundStyle(.secondary)
                            Text(PathUtils.displayName(for: path))
                                .font(.body)
                            Spacer()
                        }
                    }
                }
                .padding(Theme.Spacing.tight)
            }
            .frame(maxHeight: 160)
            .background(Color.secondary.opacity(0.06), in: RoundedRectangle(cornerRadius: Theme.Radius.small))

            VStack(alignment: .leading, spacing: 6) {
                Text("合并后目标作者名")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                TextField("目标作者名", text: $targetName)
                    .textFieldStyle(.roundedBorder)
            }

            HStack {
                Spacer()
                Button("取消", role: .cancel) {
                    isPresented = false
                }
                .keyboardShortcut(.cancelAction)

                Button("合并") {
                    let name = targetName.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !name.isEmpty else { return }
                    onMerge(name)
                    isPresented = false
                }
                .buttonStyle(.borderedProminent)
                .keyboardShortcut(.defaultAction)
                .disabled(targetName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
        .padding(Theme.Spacing.generous)
        .frame(width: 460)
        .onAppear {
            if let first = mergeTargets.first {
                targetName = PathUtils.displayName(for: first)
            }
        }
    }
}
