import Foundation

public enum HitomiDownloader {
    public static func extractGalleryId(from string: String) -> String? {
        let trimmed = string.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.allSatisfy(\.isNumber) && !trimmed.isEmpty {
            return trimmed
        }
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
        guard let url = URL(string: "https://ltn.gold-usergeneratedcontent.net/galleries/\(galleryId).js") else {
            throw NSError(domain: "HitomiDownloader", code: 0, userInfo: [NSLocalizedDescriptionKey: "无效的画册 ID"])
        }
        var request = URLRequest(url: url)
        request.setValue("https://hitomi.la/reader/\(galleryId).html", forHTTPHeaderField: "Referer")
        request.setValue("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", forHTTPHeaderField: "User-Agent")
        request.timeoutInterval = 15

        let (data, response) = try await URLSession.shared.data(for: request)
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

        let targetDirectory: String
        if preferArtistFolder && !gallery.artists.isEmpty {
            targetDirectory = PathUtils.join(
                PathUtils.join(normalizedRoot, "Authors"),
                PathUtils.join(artistClean, titleClean)
            )
        } else {
            targetDirectory = PathUtils.join(PathUtils.join(normalizedRoot, "Unsorted"), titleClean)
        }

        try FileSystem.ensureDirectory(targetDirectory)

        let total = gallery.files.count
        var downloaded = 0
        progress?(0, total, "正在准备下载画册: \(gallery.title)")

        let resolver = HitomiResolver.shared
        for (index, file) in gallery.files.enumerated() {
            try Task.checkCancellation()
            let pageNumber = index + 1
            let pageName = String(format: "%03d.webp", pageNumber)
            let filePath = URL(fileURLWithPath: targetDirectory).appendingPathComponent(pageName).path

            if FileManager.default.fileExists(atPath: filePath),
               (try? FileManager.default.attributesOfItem(atPath: filePath)[.size] as? Int ?? 0) ?? 0 > 1024 {
                downloaded += 1
                progress?(downloaded, total, "已存在 (\(downloaded)/\(total)): \(pageName)")
                continue
            }

            progress?(downloaded, total, "正在下载 (\(pageNumber)/\(total)): \(pageName)")

            let imageURL = try await resolver.resolveImageUrl(hash: file.hash, dir: "webp")
            var request = URLRequest(url: imageURL)
            request.setValue("https://hitomi.la/reader/\(gallery.id).html", forHTTPHeaderField: "Referer")
            request.setValue("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", forHTTPHeaderField: "User-Agent")
            request.timeoutInterval = 25

            let (imageData, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                throw NSError(domain: "HitomiDownloader", code: 5, userInfo: [NSLocalizedDescriptionKey: "第 \(pageNumber) 页下载失败 (HTTP \((response as? HTTPURLResponse)?.statusCode ?? 0))"])
            }

            try imageData.write(to: URL(fileURLWithPath: filePath), options: .atomic)
            downloaded += 1
            progress?(downloaded, total, "已完成 (\(downloaded)/\(total))")

            try? await Task.sleep(for: .milliseconds(200))
        }

        let metadataURL = URL(fileURLWithPath: targetDirectory).appendingPathComponent(".hitomi.json")
        if let metadata = try? JSONEncoder().encode(gallery) {
            try? metadata.write(to: metadataURL, options: .atomic)
        }

        progress?(total, total, "《\(gallery.title)》下载完成！")
        return (targetDirectory, downloaded)
    }

    public static func normalizeTitleForMatching(_ raw: String) -> String {
        var value = raw
        let patterns = [
            #"\([^\)]*\)"#,
            #"\[[^\]]*\]"#,
            #"（[^）]*）"#,
            #"【[^】]*】"#,
            #"\{[^\}]*\}"#
        ]
        for pattern in patterns {
            if let regex = try? NSRegularExpression(pattern: pattern) {
                value = regex.stringByReplacingMatches(
                    in: value,
                    range: NSRange(value.startIndex..., in: value),
                    withTemplate: " "
                )
            }
        }
        let allowed = CharacterSet.alphanumerics.union(.letters)
        let normalized = value.lowercased().unicodeScalars.filter { allowed.contains($0) }.map(String.init).joined()
        if !normalized.isEmpty {
            return normalized
        }
        return raw.lowercased().filter { scalar in
            guard let first = scalar.unicodeScalars.first else { return false }
            return allowed.contains(first)
        }
    }
}
