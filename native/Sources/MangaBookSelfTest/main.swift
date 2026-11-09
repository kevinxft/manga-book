import Foundation
import MangaBookCore

var failures = 0
var checks = 0

func expect(_ condition: Bool, _ message: String) {
    checks += 1
    if condition {
        print("  ok  \(message)")
    } else {
        failures += 1
        print("  FAIL \(message)")
    }
}

func makeDirectory(_ path: String) throws {
    try FileManager.default.createDirectory(atPath: path, withIntermediateDirectories: true)
}

func makeImages(_ directory: String, count: Int) throws {
    try makeDirectory(directory)
    for index in 1...count {
        let name = String(format: "%02d.jpg", index)
        let path = (directory as NSString).appendingPathComponent(name)
        FileManager.default.createFile(atPath: path, contents: Data([0xFF, 0xD8, 0xFF, 0xD9]))
    }
}

let fileManager = FileManager.default
let base = fileManager.temporaryDirectory
    .appendingPathComponent("mangabook-selftest-\(UUID().uuidString)", isDirectory: true)
try makeDirectory(base.path)
defer { try? fileManager.removeItem(at: base) }

let libraryRoot = base.appendingPathComponent("Test.mangalibrary", isDirectory: true).path
try makeDirectory(libraryRoot)

let service = try MangaBookService(appSupportDirectory: base)
_ = try service.setLibraryRoot(URL(fileURLWithPath: libraryRoot, isDirectory: true))

let authorsRoot = (libraryRoot as NSString).appendingPathComponent("Authors")
let unsortedRoot = (libraryRoot as NSString).appendingPathComponent("Unsorted")

try makeImages("\(authorsRoot)/Alice/SeriesOne", count: 4)
try makeImages("\(authorsRoot)/Alice/SeriesTwo/Vol1", count: 3)
try makeImages("\(authorsRoot)/Alice/SeriesTwo/Vol2", count: 5)
try makeImages("\(authorsRoot)/Bob/OnlyChild/Vol1", count: 4)
try makeImages("\(unsortedRoot)/2026-01-01/Solo", count: 5)

print("== scan ==")
try await service.scanner.syncSources([libraryRoot])
var books = try service.manga.list(MangaFilter(sort: .titleAsc))
expect(books.count == 4, "scan discovers 4 manga (got \(books.count))")

func book(_ title: String) -> MangaBook? {
    books.first { $0.title == title }
}

expect(book("SeriesOne")?.structure == .singleVolume, "SeriesOne is singleVolume")
expect(book("SeriesOne")?.totalPages == 4, "SeriesOne has 4 pages")
expect(book("SeriesTwo")?.structure == .multiVolume, "SeriesTwo is multiVolume")
expect(book("SeriesTwo")?.totalPages == 8, "SeriesTwo has 8 pages")
expect(book("Vol1") != nil, "single-volume child under a one-volume container is used")
expect(book("Solo")?.structure == .singleVolume, "Unsorted manga discovered")

let hash = SHA1.hex(PathUtils.normalize(libraryRoot))
let metadataDB = base
    .appendingPathComponent("source-metadata", isDirectory: true)
    .appendingPathComponent(hash, isDirectory: true)
    .appendingPathComponent("metadata.db")
expect(fileManager.fileExists(atPath: metadataDB.path), "source metadata DB uses the same SHA1 layout")

print("== cover ==")
if let seriesOne = book("SeriesOne") {
    let cover = await service.coverResolver.resolveCoverPath(for: seriesOne.folderPath)
    expect(cover?.hasSuffix("01.jpg") == true, "cover is the first image by name")
    let thumb = await ThumbnailService.shared.thumbnail(forImagePath: cover ?? "")
    expect(thumb == nil, "invalid test image is rejected by the decoder without crashing")
}

print("== progress preservation ==")
if let seriesOne = book("SeriesOne") {
    try service.manga.updateProgress(mangaId: seriesOne.id, chapterIndex: 0, pageIndex: 2, totalPages: 4)
    try await service.scanner.syncSources([libraryRoot])
    let refreshed = try service.manga.getById(seriesOne.id)
    expect(refreshed?.lastPageIndex == 2, "re-scan preserves reading progress")
    expect(refreshed?.addedAt == seriesOne.addedAt, "re-scan preserves addedAt")
}

print("== stale cleanup ==")
try fileManager.removeItem(atPath: "\(unsortedRoot)/2026-01-01/Solo")
try await service.scanner.syncSources([libraryRoot])
books = try service.manga.list(MangaFilter(sort: .titleAsc))
expect(books.count == 3, "removed folder is deleted from the DB")
expect(book("Solo") == nil, "stale record gone")

print("== reader ==")
if let seriesTwo = book("SeriesTwo") {
    let pages = try service.reader.listPages(mangaId: seriesTwo.id)
    expect(pages.count == 8, "multi-volume page list flattens children")
    let chapters = try service.reader.listChapters(mangaId: seriesTwo.id)
    expect(chapters.count == 2, "multi-volume chapters follow child directories")
    expect(chapters.first?.pageCount == 3, "first volume has 3 pages")
}

if let seriesOne = book("SeriesOne") {
    expect(try service.reader.listPages(mangaId: seriesOne.id).count == 4, "single volume pages")
    expect(try service.reader.listChapters(mangaId: seriesOne.id).isEmpty, "no manual chapters initially")

    var chapters = try service.reader.addChapter(mangaId: seriesOne.id, pageIndex: 2)
    expect(chapters.count == 2, "manual chapter creates two boundaries (generated start + manual)")
    let manual = chapters[1]
    chapters = try service.reader.updateChapter(
        mangaId: seriesOne.id,
        chapterId: manual.id,
        title: "第二段",
        highlighted: true
    )
    expect(chapters[1].title == "第二段", "chapter title updated")
    expect(chapters[1].highlighted, "chapter highlighted")
    chapters = try service.reader.removeChapter(mangaId: seriesOne.id, chapterId: manual.id)
    expect(chapters.isEmpty, "removing the only manual chapter clears the chapter list")
}

print("== organizer ==")
if let seriesOne = book("SeriesOne") {
    let result = try service.organizer.moveManga(
        id: seriesOne.id,
        destinationPath: "\(authorsRoot)/Bob"
    )
    expect(result.manga.folderPath == "\(authorsRoot)/Bob/SeriesOne", "moveManga updates the DB path")
    expect(fileManager.fileExists(atPath: result.manga.folderPath), "moveManga moved the folder")
}

do {
    let rename = try service.organizer.renameAuthorDirectory(path: "\(authorsRoot)/Bob", newName: "Bobby")
    expect(rename.updatedCount == 2, "renameAuthorDirectory rewrites both manga paths (got \(rename.updatedCount))")
    books = try service.manga.list()
    expect(books.allSatisfy { !$0.folderPath.contains("/Bob/") }, "no stale /Bob/ paths remain")
} catch {
    expect(false, "renameAuthorDirectory failed: \(error)")
}

try service.organizer.createAuthorDirectory(name: "Carol")
try makeImages("\(authorsRoot)/Carol/C1", count: 4)
try await service.scanner.syncSources([libraryRoot])
let merge = try service.organizer.mergeAuthorDirectories(
    paths: ["\(authorsRoot)/Bobby", "\(authorsRoot)/Carol"],
    targetName: "Merged"
)
expect(merge.movedCount == 3, "merge moves all manga (got \(merge.movedCount))")
expect(!fileManager.fileExists(atPath: "\(authorsRoot)/Bobby"), "merge removes source directory")
expect(fileManager.fileExists(atPath: "\(authorsRoot)/Merged/SeriesOne"), "merge target contains moved manga")
books = try service.manga.list()
expect(
        books.allSatisfy { !$0.folderPath.contains("/Bobby/") && !$0.folderPath.contains("/Carol/") },
        "merge leaves no source paths"
    )
    expect(
        books.filter { $0.folderPath.contains("/Merged/") }.count == 3,
        "merge updates every moved record"
    )
expect(try service.aliases.list().contains { $0.alias == "Bobby" && $0.canonicalName == "Merged" }, "merge stores aliases")

do {
    _ = try service.organizer.deleteAuthorDirectory(path: "\(authorsRoot)/Merged")
    expect(false, "deleteAuthorDirectory must refuse a directory with manga")
} catch {
    expect(true, "deleteAuthorDirectory refuses a directory with manga")
}

try service.organizer.createAuthorDirectory(name: "EmptyAuthor")
_ = try service.organizer.deleteAuthorDirectory(path: "\(authorsRoot)/EmptyAuthor")
expect(!fileManager.fileExists(atPath: "\(authorsRoot)/EmptyAuthor"), "empty author directory is trashed")

let incoming = base.appendingPathComponent("Incoming", isDirectory: true).path
try makeImages(incoming, count: 6)
let imported = try service.organizer.importMangas(into: "\(authorsRoot)/Merged", from: [incoming])
expect(imported.importedCount == 1, "importMangas moves one directory")
expect(!fileManager.fileExists(atPath: incoming), "importMangas moves the source away")
expect(fileManager.fileExists(atPath: "\(authorsRoot)/Merged/Incoming"), "imported directory lands in target")
books = try service.manga.list()
expect(book("Incoming")?.totalPages == 6, "imported manga record is created")

print("== tags ==")
if let target = books.first {
    let added = try service.tags.addToManga(mangaId: target.id, tagName: "TagA")
    expect(added.tag.id == "tag:taga", "tag id is deterministic")
    expect(try service.tags.listByManga(target.id).count == 1, "tag linked to manga")
    let set = try service.tags.setForManga(mangaId: target.id, tagNames: ["TagA", "TagB"])
    expect(set.count == 2, "setForManga replaces tag set")
    expect(try service.tags.removeFromManga(mangaId: target.id, tagName: "TagA"), "removeFromManga works")
    expect(try service.tags.list().contains { $0.name == "TagB" }, "tag list includes new tag")
    _ = try service.tags.delete(id: "tag:tagb")
    expect(!(try service.tags.list().contains { $0.name == "TagB" }), "tag delete works")
}

print("== bookmarks ==")
if let target = books.first {
    let bookmark = try service.bookmarks.create(
        mangaId: target.id,
        chapterIndex: 0,
        pageIndex: 1,
        chapterName: "第一章",
        title: "书签",
        note: "备注"
    )
    expect(try service.bookmarks.listByManga(target.id).count == 1, "bookmark created")
    let updated = try service.bookmarks.update(id: bookmark.id, title: "新书签", note: "新备注")
    expect(updated?.title == "新书签", "bookmark updated")
    expect(try service.bookmarks.delete(id: bookmark.id), "bookmark deleted")
}

print("== delete manga ==")
if let target = book("Incoming") {
    let folder = target.folderPath
    _ = try service.organizer.deleteManga(id: target.id, withFiles: true)
    expect(!fileManager.fileExists(atPath: folder), "deleteManga moves the folder to Trash")
    expect(try service.manga.getById(target.id) == nil, "deleteManga removes the DB record")
}

print("")
print(failures == 0 ? "PASS \(checks) checks" : "FAILED \(failures)/\(checks) checks")
exit(failures == 0 ? 0 : 1)
