import Foundation

public enum LibraryError: LocalizedError {
    case directoryNotFound(String)
    case noLibrary

    public var errorDescription: String? {
        switch self {
        case .directoryNotFound(let path): return "目录不存在：\(path)"
        case .noLibrary: return "请先设置漫画库。"
        }
    }
}
