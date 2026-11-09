import Foundation
import MangaBookCore

let service = try MangaBookService()
let root = try service.root()
print("root:", root?.path ?? "<none>", "display:", root?.displayName ?? "-")

let books = try service.manga.list(MangaFilter(sort: .titleAsc))
print("manga count:", books.count)
for book in books.prefix(5) {
    print(" -", book.structure.rawValue, book.totalPages, book.title, "|", book.folderPath)
}

let authors = try service.authorDirectories()
print("author directories:", authors.count)
for author in authors.prefix(5) {
    print(" -", author.mangaCount, PathUtils.displayName(for: author.directory))
}

let tags = try service.tags.list()
print("tags:", tags.count, tags.prefix(8).map(\.name))

if let first = books.first {
    let cover = await service.coverResolver.resolveCoverPath(for: first.folderPath)
    print("cover:", cover ?? "<none>", "exists:", cover.map(FileSystem.exists) ?? false)
    let pages = try service.reader.listPagePaths(for: first)
    print("pages:", pages.count, pages.first ?? "-")
    let chapters = try service.reader.listChapters(for: first)
    print("chapters:", chapters.count, chapters.prefix(3).map { "\($0.title)[\($0.startPageIndex)-\($0.endPageIndex)]" })
    if let cover {
        let started = Date()
        if let image = await ThumbnailService.shared.thumbnail(forImagePath: cover) {
            print("thumbnail:", image.width, "x", image.height, "in", String(format: "%.2fs", Date().timeIntervalSince(started)))
        } else {
            print("thumbnail: failed")
        }
    }
}

let bookmarks = try service.bookmarks.listByManga(books.first?.id ?? "")
print("bookmarks(first):", bookmarks.count)
