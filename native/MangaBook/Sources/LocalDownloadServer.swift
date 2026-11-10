import Foundation
import Network

public final class LocalDownloadServer: @unchecked Sendable {
    public static let shared = LocalDownloadServer()
    public static let defaultPort: UInt16 = 48123

    private var listener: NWListener?
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
        stop()
        do {
            let params = NWParameters.tcp
            listener = try NWListener(using: params, on: NWEndpoint.Port(rawValue: port)!)
            listener?.stateUpdateHandler = { state in
                switch state {
                case .ready:
                    print("[MangaBook] 本地下载服务已启动，监听端口: \(port)")
                case .failed(let error):
                    print("[MangaBook] 本地下载服务启动失败: \(error)")
                default:
                    break
                }
            }
            listener?.newConnectionHandler = { [weak self] connection in
                self?.handleConnection(connection)
            }
            listener?.start(queue: .global(qos: .utility))
        } catch {
            print("[MangaBook] 无法创建 NWListener: \(error)")
        }
    }

    public func stop() {
        listener?.cancel()
        listener = nil
    }

    private func handleConnection(_ connection: NWConnection) {
        connection.start(queue: .global(qos: .utility))
        connection.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] data, _, _, _ in
            guard let self, let data, let reqText = String(data: data, encoding: .utf8) else {
                connection.cancel()
                return
            }

            Task {
                await self.processRequest(connection: connection, reqText: reqText)
            }
        }
    }

    private func processRequest(connection: NWConnection, reqText: String) async {
        let lines = reqText.components(separatedBy: "\r\n")
        guard let firstLine = lines.first else {
            connection.cancel()
            return
        }
        let parts = firstLine.split(separator: " ")
        let method = parts.count > 0 ? String(parts[0]) : ""
        let fullPath = parts.count > 1 ? String(parts[1]) : ""

        let urlComponents = URLComponents(string: "http://localhost" + fullPath)
        let path = urlComponents?.path ?? fullPath

        // Handle CORS Preflight
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
            connection.send(content: cors.data(using: .utf8), completion: .contentProcessed({ _ in connection.cancel() }))
            return
        }

        // Route: GET /api/ping
        if method == "GET" && path == "/api/ping" {
            self.sendJSON(connection: connection, object: [
                "ok": true,
                "app": "MangaBook",
                "version": "0.8.0"
            ])
            return
        }

        // Route: GET /api/tasks
        if method == "GET" && path == "/api/tasks" {
            let tasks = await self.taskProvider?() ?? []
            self.sendJSON(connection: connection, object: [
                "ok": true,
                "tasks": tasks
            ])
            return
        }

        // Route: GET /api/status?id=123
        if method == "GET" && path == "/api/status" {
            let id = urlComponents?.queryItems?.first(where: { $0.name == "id" })?.value ?? ""
            if let task = await self.singleTaskProvider?(id) {
                self.sendJSON(connection: connection, object: [
                    "ok": true,
                    "task": task
                ])
            } else {
                self.sendJSON(connection: connection, status: 404, object: [
                    "ok": false,
                    "message": "Task not found"
                ])
            }
            return
        }

        // Route: POST /api/download
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
                self.sendJSON(connection: connection, status: 400, object: [
                    "ok": false,
                    "message": "Missing url or id in request body"
                ])
                return
            }

            if let task = await self.onDownloadRequested?(targetUrlOrId) {
                self.sendJSON(connection: connection, object: [
                    "ok": true,
                    "message": "Download task created",
                    "task": task
                ])
            } else {
                self.sendJSON(connection: connection, status: 400, object: [
                    "ok": false,
                    "message": "Invalid Hitomi URL or ID"
                ])
            }
            return
        }

        // 404 Default
        self.sendJSON(connection: connection, status: 404, object: ["ok": false, "message": "Endpoint not found"])
    }

    private func serializeTask(_ item: DownloadTaskItem) -> [String: Any] {
        var stateStr = "fetching"
        var progress = item.progressValue
        switch item.state {
        case .fetching:
            stateStr = "fetching"
        case .downloading(let p):
            stateStr = "downloading"
            progress = p
        case .completed:
            stateStr = "completed"
            progress = 1.0
        case .failed(let err):
            stateStr = "failed"
            return [
                "id": item.id,
                "title": item.title,
                "artist": item.artist ?? "",
                "state": stateStr,
                "error": err,
                "progress": 0,
                "statusText": item.statusText
            ]
        }

        return [
            "id": item.id,
            "title": item.title,
            "artist": item.artist ?? "",
            "tags": item.tags,
            "totalPages": item.totalPages,
            "completedPages": item.completedPages,
            "state": stateStr,
            "progress": progress,
            "statusText": item.statusText,
            "folderPath": item.folderPath ?? ""
        ]
    }

    private func sendJSON(connection: NWConnection, status: Int = 200, object: Any) {
        guard let data = try? JSONSerialization.data(withJSONObject: object) else {
            connection.cancel()
            return
        }
        let statusText = status == 200 ? "OK" : (status == 404 ? "Not Found" : "Bad Request")
        let header = """
        HTTP/1.1 \(status) \(statusText)\r
        Content-Type: application/json; charset=utf-8\r
        Access-Control-Allow-Origin: *\r
        Content-Length: \(data.count)\r
        \r\n
        """
        guard let headerData = header.data(using: .utf8) else {
            connection.cancel()
            return
        }
        var full = Data()
        full.append(headerData)
        full.append(data)
        connection.send(content: full, completion: .contentProcessed({ _ in connection.cancel() }))
    }
}
