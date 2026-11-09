// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "MangaBookCore",
    platforms: [.macOS(.v15)],
    products: [
        .library(name: "MangaBookCore", targets: ["MangaBookCore"])
    ],
    dependencies: [
        .package(url: "https://github.com/groue/GRDB.swift.git", from: "7.0.0")
    ],
    targets: [
        .target(
            name: "MangaBookCore",
            dependencies: [.product(name: "GRDB", package: "GRDB.swift")],
            swiftSettings: [.swiftLanguageMode(.v5)]
        ),
        .executableTarget(
            name: "MangaBookProbe",
            dependencies: ["MangaBookCore"],
            path: "Sources/MangaBookProbe",
            swiftSettings: [.swiftLanguageMode(.v5)]
        ),
        .executableTarget(
            name: "MangaBookSelfTest",
            dependencies: ["MangaBookCore"],
            path: "Sources/MangaBookSelfTest",
            swiftSettings: [.swiftLanguageMode(.v5)]
        )
    ]
)
