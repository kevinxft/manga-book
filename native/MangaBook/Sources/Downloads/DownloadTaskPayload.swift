struct DownloadTaskPayload: Sendable {
    let id: String
    var title: String
    var artist = ""
    var tags: [String] = []
    var totalPages = 0
    var completedPages = 0
    var state: String
    var progress: Double
    var statusText: String
    var folderPath = ""
    var error: String?
    var alreadyExists: Bool?

    var jsonObject: [String: Any] {
        var object: [String: Any] = [
            "id": id,
            "title": title,
            "artist": artist,
            "tags": tags,
            "totalPages": totalPages,
            "completedPages": completedPages,
            "state": state,
            "progress": progress,
            "statusText": statusText,
            "folderPath": folderPath
        ]
        if let error {
            object["error"] = error
        }
        if let alreadyExists {
            object["alreadyExists"] = alreadyExists
        }
        return object
    }
}
