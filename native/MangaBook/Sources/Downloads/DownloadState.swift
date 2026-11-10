public enum DownloadState: Sendable, Equatable {
    case fetching
    case downloading(progress: Double)
    case completed
    case failed(String)
}
