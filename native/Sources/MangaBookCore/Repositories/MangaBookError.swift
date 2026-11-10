import Foundation

public enum MangaBookError: LocalizedError {
    case pathOutsideRoot(String, String)
    case recordNotFound
    case crossRootRename

    public var errorDescription: String? {
        switch self {
        case .pathOutsideRoot(let path, let root): return "路径 \(path) 不在库根目录 \(root) 内"
        case .recordNotFound: return "漫画记录不存在"
        case .crossRootRename: return "作者目录重命名不能跨库"
        }
    }
}
