import Foundation

public enum ImageFiles {
    public static let supportedExtensions: Set<String> = [
        ".avif", ".bmp", ".gif", ".heic", ".heif", ".jpeg", ".jpg", ".png", ".tif", ".tiff", ".webp"
    ]

    public static func isSupported(_ fileName: String) -> Bool {
        let fileExtension = ("." + (fileName as NSString).pathExtension).lowercased()
        return supportedExtensions.contains(fileExtension)
    }
}
