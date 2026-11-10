import Foundation

public enum ReaderError: LocalizedError {
    case unsupported
    case noPages
    case invalidPage
    case duplicateChapter
    case invalidChapter
    case chapterNotFound
    case nothingToUpdate
    case noPagesSelected
    case foreignPage
    case mustKeepOnePage

    public var errorDescription: String? {
        switch self {
        case .unsupported: return "当前漫画已按目录分章节，暂不支持该操作。"
        case .noPages: return "当前漫画没有可分章的页面。"
        case .invalidPage: return "章节起始页无效。"
        case .duplicateChapter: return "当前页已经是章节起点。"
        case .invalidChapter: return "该章节不能删除或修改。"
        case .chapterNotFound: return "章节不存在。"
        case .nothingToUpdate: return "未提供章节更新内容。"
        case .noPagesSelected: return "请选择要删除的页面。"
        case .foreignPage: return "包含不属于当前漫画的页面，无法删除。"
        case .mustKeepOnePage: return "至少需要保留 1 页漫画。"
        }
    }
}
