import Foundation
import JavaScriptCore

public struct HitomiFile: Sendable, Codable {
    public let name: String
    public let hash: String
    public let width: Int?
    public let height: Int?
    public let haswebp: Int?
    public let hasavif: Int?

    public init(name: String, hash: String, width: Int? = nil, height: Int? = nil, haswebp: Int? = nil, hasavif: Int? = nil) {
        self.name = name
        self.hash = hash
        self.width = width
        self.height = height
        self.haswebp = haswebp
        self.hasavif = hasavif
    }
}

public struct HitomiGallery: Sendable, Codable {
    public let id: String
    public let title: String
    public let japaneseTitle: String?
    public let type: String?
    public let language: String?
    public let artists: [String]
    public let tags: [String]
    public let files: [HitomiFile]

    public var artistDisplay: String {
        artists.first ?? "Unknown"
    }

    public init(
        id: String,
        title: String,
        japaneseTitle: String? = nil,
        type: String? = nil,
        language: String? = nil,
        artists: [String] = [],
        tags: [String] = [],
        files: [HitomiFile] = []
    ) {
        self.id = id
        self.title = title
        self.japaneseTitle = japaneseTitle
        self.type = type
        self.language = language
        self.artists = artists
        self.tags = tags
        self.files = files
    }
}

public actor HitomiResolver {
    public static let shared = HitomiResolver()

    private var cachedGgJs: String?
    private var lastFetchTime: Date?
    private let domain2 = "gold-usergeneratedcontent.net"

    private let helperScript = """
    function resolveImageUrl(hash, dir) {
        var b = 16;
        var r = /\\/[0-9a-f]{61}([0-9a-f]{2})([0-9a-f])/;
        var dummyUrl = "/" + hash;
        var m = r.exec(dummyUrl);
        var retval = "w";
        if (m) {
            var g = parseInt(m[2] + m[1], b);
            if (!isNaN(g)) {
                retval += (1 + gg.m(g));
            }
        }
        var fullPath = gg.b + gg.s(hash) + "/" + hash + "." + dir;
        return "https://" + retval + "." + domain2 + "/" + fullPath;
    }
    """

    public func getOrFetchGgJs() async throws -> String {
        if let cached = cachedGgJs, let time = lastFetchTime, Date().timeIntervalSince(time) < 1800 {
            return cached
        }
        let url = URL(string: "https://ltn.gold-usergeneratedcontent.net/gg.js")!
        var req = URLRequest(url: url)
        req.setValue("https://hitomi.la/", forHTTPHeaderField: "Referer")
        req.setValue("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", forHTTPHeaderField: "User-Agent")
        req.timeoutInterval = 15

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw NSError(domain: "HitomiResolver", code: 1, userInfo: [NSLocalizedDescriptionKey: "获取 gg.js 脚本失败"])
        }
        let script = String(decoding: data, as: UTF8.self)
        cachedGgJs = script
        lastFetchTime = Date()
        return script
    }

    public func resolveImageUrl(hash: String, dir: String = "webp") async throws -> URL {
        let ggJs = try await getOrFetchGgJs()
        let context = JSContext()!
        context.setObject(domain2 as NSString, forKeyedSubscript: "domain2" as NSString)
        context.evaluateScript("var gg = {};")
        context.evaluateScript(ggJs)
        context.evaluateScript(helperScript)

        guard let fn = context.objectForKeyedSubscript("resolveImageUrl") else {
            throw NSError(domain: "HitomiResolver", code: 2, userInfo: [NSLocalizedDescriptionKey: "无法初始化 URL 解析函数"])
        }
        let res = fn.call(withArguments: [hash, dir])
        guard let urlStr = res?.toString(), urlStr.hasPrefix("https://"), let url = URL(string: urlStr) else {
            throw NSError(domain: "HitomiResolver", code: 3, userInfo: [NSLocalizedDescriptionKey: "解析图片地址返回无效结果: \(String(describing: res))"])
        }
        return url
    }
}

public enum HitomiDownloader {
    public static func extractGalleryId(from string: String) -> String? {
        let trimmed = string.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.allSatisfy(\.isNumber) && !trimmed.isEmpty {
            return trimmed
        }
        // Match ...-<id>.html or /reader/<id>.html or /galleries/<id>.html
        let patterns = [
            #"[/-]([0-9]+)\.html"#,
            #"/galleries/([0-9]+)"#,
            #"/reader/([0-9]+)"#,
            #"([0-9]{5,})"#
        ]
        for pattern in patterns {
            if let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive),
               let match = regex.firstMatch(in: trimmed, range: NSRange(trimmed.startIndex..., in: trimmed)),
               match.numberOfRanges > 1,
               let range = Range(match.range(at: 1), in: trimmed) {
                return String(trimmed[range])
            }
        }
        return nil
    }

    public static func fetchMetadata(galleryId: String) async throws -> HitomiGallery {
        let url = URL(string: "https://ltn.gold-usergeneratedcontent.net/galleries/\(galleryId).js")!
        var req = URLRequest(url: url)
        req.setValue("https://hitomi.la/reader/\(galleryId).html", forHTTPHeaderField: "Referer")
        req.setValue("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", forHTTPHeaderField: "User-Agent")
        req.timeoutInterval = 15

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw NSError(domain: "HitomiDownloader", code: 404, userInfo: [NSLocalizedDescriptionKey: "画册元数据不存在 (ID: \(galleryId))"])
        }

        var text = String(decoding: data, as: UTF8.self).trimmingCharacters(in: .whitespacesAndNewlines)
        if text.hasPrefix("var galleryinfo = ") {
            text.removeFirst("var galleryinfo = ".count)
        }
        if text.hasSuffix(";") {
            text.removeLast()
        }

        struct RawArtist: Decodable {
            let artist: String?
        }
        struct RawTag: Decodable {
            let tag: String?
        }
        struct RawFile: Decodable {
            let name: String
            let hash: String
            let width: Int?
            let height: Int?
            let haswebp: Int?
            let hasavif: Int?
        }
        struct RawGallery: Decodable {
            let id: String
            let title: String
            let japanese_title: String?
            let type: String?
            let language: String?
            let artists: [RawArtist]?
            let tags: [RawTag]?
            let files: [RawFile]
        }

        let raw = try JSONDecoder().decode(RawGallery.self, from: Data(text.utf8))
        let artists = (raw.artists ?? []).compactMap(\.artist).filter { !$0.isEmpty }
        let tags = (raw.tags ?? []).compactMap(\.tag).filter { !$0.isEmpty }
        let files = raw.files.map {
            HitomiFile(name: $0.name, hash: $0.hash, width: $0.width, height: $0.height, haswebp: $0.haswebp, hasavif: $0.hasavif)
        }

        return HitomiGallery(
            id: raw.id,
            title: raw.title,
            japaneseTitle: raw.japanese_title,
            type: raw.type,
            language: raw.language,
            artists: artists,
            tags: tags,
            files: files
        )
    }

    public static func downloadGallery(
        gallery: HitomiGallery,
        libraryRoot: String,
        preferArtistFolder: Bool = true,
        progress: (@Sendable (Int, Int, String) -> Void)? = nil
    ) async throws -> (folderPath: String, count: Int) {
        let normalizedRoot = PathUtils.normalize(libraryRoot)
        let artistClean = PathUtils.sanitizePathComponent(gallery.artistDisplay)
        let titleClean = PathUtils.sanitizePathComponent(gallery.title)

        let targetDir: String
        if preferArtistFolder && !gallery.artists.isEmpty {
            targetDir = PathUtils.join(PathUtils.join(normalizedRoot, "Authors"), PathUtils.join(artistClean, titleClean))
        } else {
            targetDir = PathUtils.join(PathUtils.join(normalizedRoot, "Unsorted"), titleClean)
        }

        try FileSystem.ensureDirectory(targetDir)

        let total = gallery.files.count
        var downloaded = 0
        progress?(0, total, "正在准备下载画册: \(gallery.title)")

        let resolver = HitomiResolver.shared

        for (idx, file) in gallery.files.enumerated() {
            try Task.checkCancellation()
            let pageNum = idx + 1
            let pageName = String(format: "%03d.webp", pageNum)
            let filePath = (targetDir as NSString).appendingPathComponent(pageName)

            // If already downloaded and not empty, skip
            if FileManager.default.fileExists(atPath: filePath),
               (try? FileManager.default.attributesOfItem(atPath: filePath)[.size] as? Int ?? 0) ?? 0 > 1024 {
                downloaded += 1
                progress?(downloaded, total, "已存在 (\(downloaded)/\(total)): \(pageName)")
                continue
            }

            progress?(downloaded, total, "正在下载 (\(pageNum)/\(total)): \(pageName)")

            let imageUrl = try await resolver.resolveImageUrl(hash: file.hash, dir: "webp")
            var req = URLRequest(url: imageUrl)
            req.setValue("https://hitomi.la/reader/\(gallery.id).html", forHTTPHeaderField: "Referer")
            req.setValue("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", forHTTPHeaderField: "User-Agent")
            req.timeoutInterval = 25

            let (imgData, response) = try await URLSession.shared.data(for: req)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                throw NSError(domain: "HitomiDownloader", code: 5, userInfo: [NSLocalizedDescriptionKey: "第 \(pageNum) 页下载失败 (HTTP \((response as? HTTPURLResponse)?.statusCode ?? 0))"])
            }

            try imgData.write(to: URL(fileURLWithPath: filePath), options: .atomic)
            downloaded += 1
            progress?(downloaded, total, "已完成 (\(downloaded)/\(total))")

            // Gentle delay to avoid CDN rate limiting
            try? await Task.sleep(nanoseconds: 200_000_000) // 200ms
        }

        // Write metadata file `.hitomi.json` in the folder
        let metaUrl = URL(fileURLWithPath: targetDir).appendingPathComponent(".hitomi.json")
        if let metaData = try? JSONEncoder().encode(gallery) {
            try? metaData.write(to: metaUrl, options: .atomic)
        }

        progress?(total, total, "《\(gallery.title)》下载完成！")
        return (targetDir, downloaded)
    }

    public static func normalizeTitleForMatching(_ raw: String) -> String {
        var s = raw
        let patterns = [
            #"\([^\)]*\)"#,
            #"\[[^\]]*\]"#,
            #"（[^）]*）"#,
            #"【[^】]*】"#,
            #"\{[^\}]*\}"#
        ]
        for p in patterns {
            if let regex = try? NSRegularExpression(pattern: p) {
                s = regex.stringByReplacingMatches(in: s, range: NSRange(s.startIndex..., in: s), withTemplate: " ")
            }
        }
        let allowed = CharacterSet.alphanumerics.union(.letters)
        let normalized = s.lowercased().unicodeScalars.filter { allowed.contains($0) }.map(String.init).joined()
        return normalized.isEmpty ? raw.lowercased().filter { allowed.contains($0.unicodeScalars.first!) } : normalized
    }
}
