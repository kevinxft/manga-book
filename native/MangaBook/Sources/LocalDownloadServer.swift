import Foundation
import Darwin

public final class LocalDownloadServer: @unchecked Sendable {
    public static let shared = LocalDownloadServer()
    public static let defaultPort: UInt16 = 48123

    private var serverFd: Int32 = -1
    private var listenTask: Task<Void, Never>?
    private var isRunning = false
    private let lock = NSLock()

    private var onDownloadRequested: (@Sendable (String) async -> [String: Any]?)?
    private var taskProvider: (@Sendable () async -> [[String: Any]])?
    private var singleTaskProvider: (@Sendable (String) async -> [String: Any]?)?

    public init() {}

    public func configure(
        onDownloadRequested: @escaping @Sendable (String) async -> [String: Any]?,
        taskProvider: @escaping @Sendable () async -> [[String: Any]],
        singleTaskProvider: @escaping @Sendable (String) async -> [String: Any]?
    ) {
        self.onDownloadRequested = onDownloadRequested
        self.taskProvider = taskProvider
        self.singleTaskProvider = singleTaskProvider
    }

    public func start(port: UInt16 = defaultPort) {
        lock.withLock {
            guard !isRunning else { return }
            stopInternal()

            let fd = socket(AF_INET, SOCK_STREAM, 0)
            guard fd >= 0 else {
                print("[MangaBook] 无法创建 socket: errno \(errno)")
                return
            }

            var yes: Int32 = 1
            setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &yes, socklen_t(MemoryLayout<Int32>.size))

            var addr = sockaddr_in()
            addr.sin_family = sa_family_t(AF_INET)
            addr.sin_port = in_port_t(port).bigEndian
            addr.sin_addr.s_addr = inet_addr("127.0.0.1")

            var bindAddr = sockaddr()
            memcpy(&bindAddr, &addr, Int(MemoryLayout<sockaddr_in>.size))

            guard bind(fd, &bindAddr, socklen_t(MemoryLayout<sockaddr_in>.size)) == 0 else {
                print("[MangaBook] 绑定端口 \(port) 失败: errno \(errno)")
                Darwin.close(fd)
                return
            }

            guard listen(fd, 32) == 0 else {
                print("[MangaBook] 监听端口 \(port) 失败: errno \(errno)")
                Darwin.close(fd)
                return
            }

            serverFd = fd
            isRunning = true
            print("[MangaBook] 本地下载服务已启动，监听 127.0.0.1:\(port)")

            listenTask = Task.detached(priority: .utility) { [weak self] in
                while !Task.isCancelled {
                    var clientAddr = sockaddr()
                    var len = socklen_t(MemoryLayout<sockaddr>.size)
                    let clientFd = accept(fd, &clientAddr, &len)
                    guard clientFd >= 0 else { break }

                    Task.detached(priority: .utility) { [weak self] in
                        await self?.handleClient(clientFd)
                    }
                }
            }
        }
    }

    public func stop() {
        lock.withLock {
            stopInternal()
        }
    }

    private func stopInternal() {
        isRunning = false
        listenTask?.cancel()
        listenTask = nil
        if serverFd >= 0 {
            Darwin.close(serverFd)
            serverFd = -1
        }
    }

    private func handleClient(_ clientFd: Int32) async {
        defer { Darwin.close(clientFd) }

        var buffer = [UInt8](repeating: 0, count: 65536)
        let bytesRead = read(clientFd, &buffer, buffer.count)
        guard bytesRead > 0 else { return }

        let reqText = String(decoding: buffer.prefix(bytesRead), as: UTF8.self)
        let lines = reqText.components(separatedBy: "\r\n")
        guard let firstLine = lines.first else { return }

        let parts = firstLine.split(separator: " ")
        let method = parts.count > 0 ? String(parts[0]) : ""
        let fullPath = parts.count > 1 ? String(parts[1]) : ""

        let urlComponents = URLComponents(string: "http://localhost" + fullPath)
        let path = urlComponents?.path ?? fullPath

        // CORS Preflight
        if method == "OPTIONS" {
            let cors = """
            HTTP/1.1 204 No Content\r
            Access-Control-Allow-Origin: *\r
            Access-Control-Allow-Methods: GET, POST, OPTIONS\r
            Access-Control-Allow-Headers: Content-Type\r
            Access-Control-Max-Age: 86400\r
            Content-Length: 0\r
            \r\n
            """
            _ = cors.withCString { write(clientFd, $0, strlen($0)) }
            return
        }

        // GET /api/ping
        if method == "GET" && path == "/api/ping" {
            sendJSON(clientFd: clientFd, object: [
                "ok": true,
                "app": "MangaBook",
                "version": "0.8.0"
            ])
            return
        }

        // GET /api/tasks
        if method == "GET" && path == "/api/tasks" {
            let tasks = await taskProvider?() ?? []
            sendJSON(clientFd: clientFd, object: [
                "ok": true,
                "tasks": tasks
            ])
            return
        }

        // GET /api/status?id=123
        if method == "GET" && path == "/api/status" {
            let id = urlComponents?.queryItems?.first(where: { $0.name == "id" })?.value ?? ""
            if let task = await singleTaskProvider?(id) {
                sendJSON(clientFd: clientFd, object: [
                    "ok": true,
                    "task": task
                ])
            } else {
                sendJSON(clientFd: clientFd, status: 404, object: [
                    "ok": false,
                    "message": "Task not found"
                ])
            }
            return
        }

        // POST /api/download
        if method == "POST" && path == "/api/download" {
            var bodyString = ""
            if let range = reqText.range(of: "\r\n\r\n") {
                bodyString = String(reqText[range.upperBound...])
            }

            var targetUrlOrId = ""
            if let bodyData = bodyString.data(using: .utf8),
               let json = try? JSONSerialization.jsonObject(with: bodyData) as? [String: Any] {
                targetUrlOrId = (json["url"] as? String) ?? (json["id"] as? String) ?? ""
            }

            if targetUrlOrId.isEmpty {
                sendJSON(clientFd: clientFd, status: 400, object: [
                    "ok": false,
                    "message": "Missing url or id in request body"
                ])
                return
            }

            if let task = await onDownloadRequested?(targetUrlOrId) {
                sendJSON(clientFd: clientFd, object: [
                    "ok": true,
                    "message": "Download task created",
                    "task": task
                ])
            } else {
                sendJSON(clientFd: clientFd, status: 400, object: [
                    "ok": false,
                    "message": "Invalid Hitomi URL or ID"
                ])
            }
            return
        }

        sendJSON(clientFd: clientFd, status: 404, object: [
            "ok": false,
            "message": "Endpoint not found"
        ])
    }

    private func sendJSON(clientFd: Int32, status: Int = 200, object: Any) {
        guard let data = try? JSONSerialization.data(withJSONObject: object) else { return }
        let statusText = status == 200 ? "OK" : (status == 404 ? "Not Found" : "Bad Request")
        let header = """
        HTTP/1.1 \(status) \(statusText)\r
        Content-Type: application/json; charset=utf-8\r
        Access-Control-Allow-Origin: *\r
        Content-Length: \(data.count)\r
        \r\n
        """
        guard let headerData = header.data(using: .utf8) else { return }
        var full = Data()
        full.append(headerData)
        full.append(data)
        _ = full.withUnsafeBytes { ptr in
            write(clientFd, ptr.baseAddress, ptr.count)
        }
    }
}
