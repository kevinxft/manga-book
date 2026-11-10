import Foundation

public enum OrganizerError: LocalizedError {
    case invalidName
    case destinationExists(String)
    case directoryNotFound(String)
    case directoryNotEmpty(String)
    case directoryHasManga(String)
    case mergeNeedsTwoDirectories
    case mergeDifferentParents
    case nameResolutionFailed(String)

    public var errorDescription: String? {
        switch self {
        case .invalidName: return "名称无效"
        case .destinationExists(let path): return "目标已存在：\(path)"
        case .directoryNotFound(let path): return "目录不存在：\(path)"
        case .directoryNotEmpty(let path): return "目录包含无法合并的文件：\(path)"
        case .directoryHasManga(let path): return "该作者目录下还有漫画，不能删除：\(path)"
        case .mergeNeedsTwoDirectories: return "至少选择两个作者目录才能合并"
        case .mergeDifferentParents: return "只能合并同一 Authors 根目录下的作者目录"
        case .nameResolutionFailed(let name): return "无法为 \(name) 生成可用的目录名"
        }
    }
}
