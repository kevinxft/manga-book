import MangaBookCore
import SwiftUI

struct AuthorSidebarRow: View {
    let author: TargetDirectorySummary

    var body: some View {
        Label {
            Text(PathUtils.displayName(for: author.directory))
                .lineLimit(1)
        } icon: {
            Image(systemName: "folder.fill")
                .symbolRenderingMode(.hierarchical)
        }
        .badge(author.mangaCount)
    }
}
