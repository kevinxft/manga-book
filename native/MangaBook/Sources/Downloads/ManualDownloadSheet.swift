import MangaBookCore
import SwiftUI

struct ManualDownloadSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    @State private var input = ""
    @State private var preferArtist = true
    @State private var errorText: String?

    var body: some View {
        VStack(spacing: 16) {
            HStack {
                Text("添加 Hitomi 下载")
                    .font(.headline)
                Spacer()
                Button {
                    dismiss()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("输入 Hitomi 网址或画册 ID")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                TextField("粘贴漫画网址或画册编号…", text: $input)
                    .textFieldStyle(.roundedBorder)

                Toggle("按作者自动创建分类目录 (Authors/作者/漫画名)", isOn: $preferArtist)
                    .font(.caption)
            }

            if let errorText {
                Text(errorText)
                    .font(.caption)
                    .foregroundStyle(.red)
            }

            HStack {
                Button("取消") { dismiss() }
                    .keyboardShortcut(.cancelAction)

                Spacer()

                Button("开始下载") {
                    startDownload()
                }
                .buttonStyle(.borderedProminent)
                .keyboardShortcut(.defaultAction)
            }
        }
        .padding(20)
        .frame(width: 460)
    }

    private func startDownload() {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        guard HitomiDownloader.extractGalleryId(from: trimmed) != nil else {
            errorText = "无法识别有效的 Hitomi 链接或画册 ID"
            return
        }
        model.downloadHitomi(urlOrId: trimmed, preferArtistFolder: preferArtist)
        dismiss()
    }
}
