import Foundation

public enum PathUtils {
    /// Lexical normalization matching Node's path.resolve + path.normalize.
    public static func normalize(_ input: String) -> String {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return trimmed }
        let expanded = (trimmed as NSString).expandingTildeInPath
        return URL(fileURLWithPath: expanded).standardizedFileURL.path
    }

    public static func displayName(for path: String) -> String {
        (normalize(path) as NSString).lastPathComponent
    }

    public static func isInside(_ targetPath: String, _ parentPath: String) -> Bool {
        let target = normalize(targetPath)
        let parent = normalize(parentPath)
        return target == parent || target.hasPrefix(parent + "/")
    }

    public static func relativePath(from root: String, to target: String) -> String? {
        let rootPath = normalize(root)
        let targetPath = normalize(target)
        guard isInside(targetPath, rootPath), targetPath != rootPath else { return nil }
        var relative = String(targetPath.dropFirst(rootPath.count))
        while relative.hasPrefix("/") { relative.removeFirst() }
        while relative.hasSuffix("/") { relative.removeLast() }
        return relative
    }

    public static func join(_ root: String, _ relative: String) -> String {
        normalize((root as NSString).appendingPathComponent(relative))
    }

    public static func key(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    public static func sanitizePathComponent(_ name: String) -> String {
        let invalidChars = CharacterSet(charactersIn: "/\\?%*|\":<>")
        let sanitized = name.components(separatedBy: invalidChars).joined(separator: "_")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return sanitized.isEmpty ? "Untitled" : sanitized
    }
}
