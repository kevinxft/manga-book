import SwiftUI
import MangaBookCore

struct SetAuthorSheet: View {
    let mangaIDs: [String]
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    @State private var searchQuery = ""
    @State private var isProcessing = false

    private var singleBook: MangaBook? {
        guard mangaIDs.count == 1, let id = mangaIDs.first else { return nil }
        return model.book(id: id)
    }

    private var currentAuthorName: String? {
        guard let singleBook else { return nil }
        return model.authorName(for: singleBook)
    }

    private var filteredAuthors: [TargetDirectorySummary] {
        let q = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !q.isEmpty else { return model.authors }
        return model.authors.filter { author in
            let name = PathUtils.displayName(for: author.directory).lowercased()
            return name.contains(q)
        }
    }

    private var hasExactMatch: Bool {
        let q = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !q.isEmpty else { return true }
        return model.authors.contains {
            PathUtils.displayName(for: $0.directory).lowercased() == q
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.standard) {
            // Header
            VStack(alignment: .leading, spacing: 3) {
                Text("设置作者")
                    .font(.title3)
                    .bold()

                if let singleBook {
                    HStack(spacing: 6) {
                        Text(singleBook.title)
                            .lineLimit(1)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)

                        if let author = currentAuthorName {
                            Text("当前: \(author)")
                                .font(.caption)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Capsule().fill(Color.accentColor.opacity(0.14)))
                                .foregroundStyle(Color.accentColor)
                        } else {
                            Text("未分类")
                                .font(.caption)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Capsule().fill(Color.secondary.opacity(0.12)))
                                .foregroundStyle(.secondary)
                        }
                    }
                } else {
                    Text("已选 \(mangaIDs.count) 本漫画")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }

            // Search / New author input
            HStack(spacing: Theme.Spacing.tight) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.tertiary)
                TextField("搜索作者，或直接输入新作者名…", text: $searchQuery)
                    .textFieldStyle(.plain)
                    .font(.body)
                if !searchQuery.isEmpty {
                    Button {
                        searchQuery = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: Theme.Radius.standard))

            // Author Candidate List
            List {
                // If user typed a new author name not in existing authors
                if !hasExactMatch {
                    let trimmed = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
                    Button {
                        setAuthor(trimmed)
                    } label: {
                        HStack(spacing: Theme.Spacing.standard) {
                            Image(systemName: "folder.badge.plus")
                                .foregroundStyle(Color.accentColor)
                                .frame(width: 20)
                            VStack(alignment: .leading, spacing: 1) {
                                Text("新建作者「\(trimmed)」并移动")
                                    .font(.body)
                                    .fontWeight(.medium)
                                    .foregroundStyle(Color.accentColor)
                                Text("将在 Authors 目录下新建此作者目录")
                                    .font(.caption)
                                    .foregroundStyle(.tertiary)
                            }
                            Spacer()
                        }
                        .padding(.vertical, 2)
                    }
                    .buttonStyle(.plain)
                }

                // Option: Move to Unsorted
                if currentAuthorName != nil, let unsorted = model.unsortedRootPath {
                    Button {
                        moveTo(unsorted)
                    } label: {
                        HStack(spacing: Theme.Spacing.standard) {
                            Image(systemName: "tray.and.arrow.down.fill")
                                .foregroundStyle(.secondary)
                                .frame(width: 20)
                            VStack(alignment: .leading, spacing: 1) {
                                Text("移至未分类 (Unsorted)")
                                    .font(.body)
                                Text("移出当前作者目录")
                                    .font(.caption)
                                    .foregroundStyle(.tertiary)
                            }
                            Spacer()
                        }
                        .padding(.vertical, 2)
                    }
                    .buttonStyle(.plain)
                }

                // Existing Authors Section
                Section("已有作者目录") {
                    ForEach(filteredAuthors) { author in
                        let authorName = PathUtils.displayName(for: author.directory)
                        let isCurrent = currentAuthorName == authorName

                        Button {
                            moveTo(author.directory)
                        } label: {
                            HStack(spacing: Theme.Spacing.standard) {
                                Image(systemName: "folder.fill")
                                    .foregroundStyle(isCurrent ? Color.accentColor : Color.secondary)
                                    .frame(width: 20)

                                Text(authorName)
                                    .font(.body)
                                    .fontWeight(isCurrent ? .semibold : .regular)
                                    .foregroundStyle(isCurrent ? Color.accentColor : Color.primary)

                                Spacer()

                                if isCurrent {
                                    Text("当前")
                                        .font(.caption2)
                                        .foregroundStyle(Color.accentColor)
                                        .padding(.horizontal, 5)
                                        .padding(.vertical, 1)
                                        .background(Capsule().fill(Color.accentColor.opacity(0.14)))
                                }

                                Text("\(author.mangaCount) 本")
                                    .font(.caption.monospacedDigit())
                                    .foregroundStyle(.secondary)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(Capsule().fill(Color.secondary.opacity(0.10)))
                            }
                            .padding(.vertical, 2)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .listStyle(.inset)
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.standard))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.Radius.standard)
                    .stroke(Color.secondary.opacity(0.15), lineWidth: 0.5)
            )
            .frame(height: 320)

            // Footer
            HStack {
                if isProcessing {
                    ProgressView()
                        .controlSize(.small)
                    Text("正在移动…")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Button("取消", role: .cancel) { dismiss() }
                    .keyboardShortcut(.cancelAction)
            }
        }
        .padding(Theme.Spacing.generous)
        .frame(width: 480)
    }

    private func setAuthor(_ name: String) {
        guard let authorsRoot = model.authorsRootPath else { return }
        let destination = PathUtils.join(authorsRoot, name)
        moveTo(destination)
    }

    private func moveTo(_ destination: String) {
        guard !isProcessing else { return }
        isProcessing = true
        Task {
            await model.moveMangas(ids: mangaIDs, to: destination)
            isProcessing = false
            dismiss()
        }
    }
}
