public struct ScanProgressPayload: Sendable, Equatable {
    public var current: Int
    public var total: Int
    public var message: String
    public var sourceCurrent: Int
    public var sourceTotal: Int
    public var sourceName: String
    public var itemCurrent: Int
    public var itemTotal: Int
    public var currentItemName: String

    public init(
        current: Int = 0,
        total: Int = 0,
        message: String = "",
        sourceCurrent: Int = 0,
        sourceTotal: Int = 0,
        sourceName: String = "",
        itemCurrent: Int = 0,
        itemTotal: Int = 0,
        currentItemName: String = ""
    ) {
        self.current = current
        self.total = total
        self.message = message
        self.sourceCurrent = sourceCurrent
        self.sourceTotal = sourceTotal
        self.sourceName = sourceName
        self.itemCurrent = itemCurrent
        self.itemTotal = itemTotal
        self.currentItemName = currentItemName
    }
}
