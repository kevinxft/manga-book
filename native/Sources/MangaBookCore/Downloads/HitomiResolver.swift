import Foundation
import JavaScriptCore

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
        if let cachedGgJs, let lastFetchTime, Date.now.timeIntervalSince(lastFetchTime) < 1800 {
            return cachedGgJs
        }
        guard let url = URL(string: "https://ltn.gold-usergeneratedcontent.net/gg.js") else {
            throw NSError(domain: "HitomiResolver", code: 0, userInfo: [NSLocalizedDescriptionKey: "无效的 gg.js 地址"])
        }
        var request = URLRequest(url: url)
        request.setValue("https://hitomi.la/", forHTTPHeaderField: "Referer")
        request.setValue("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", forHTTPHeaderField: "User-Agent")
        request.timeoutInterval = 15

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw NSError(domain: "HitomiResolver", code: 1, userInfo: [NSLocalizedDescriptionKey: "获取 gg.js 脚本失败"])
        }
        let script = String(decoding: data, as: UTF8.self)
        cachedGgJs = script
        lastFetchTime = .now
        return script
    }

    public func resolveImageUrl(hash: String, dir: String = "webp") async throws -> URL {
        let ggJs = try await getOrFetchGgJs()
        guard let context = JSContext() else {
            throw NSError(domain: "HitomiResolver", code: 2, userInfo: [NSLocalizedDescriptionKey: "无法创建 JavaScript 上下文"])
        }
        context.setObject(domain2 as NSString, forKeyedSubscript: "domain2" as NSString)
        context.evaluateScript("var gg = {};")
        context.evaluateScript(ggJs)
        context.evaluateScript(helperScript)

        guard let function = context.objectForKeyedSubscript("resolveImageUrl") else {
            throw NSError(domain: "HitomiResolver", code: 2, userInfo: [NSLocalizedDescriptionKey: "无法初始化 URL 解析函数"])
        }
        let result = function.call(withArguments: [hash, dir])
        guard let urlString = result?.toString(), urlString.hasPrefix("https://"), let url = URL(string: urlString) else {
            throw NSError(domain: "HitomiResolver", code: 3, userInfo: [NSLocalizedDescriptionKey: "解析图片地址返回无效结果: \(String(describing: result))"])
        }
        return url
    }
}
