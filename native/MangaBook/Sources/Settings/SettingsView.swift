import AppKit
import MangaBookCore
import SwiftUI

struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    @AppStorage("reader.mode") private var readerMode = ReaderMode.paged.rawValue
    @AppStorage("reader.widthMode") private var widthMode = ReaderWidthMode.fit.rawValue
    @AppStorage("reader.widthPercent") private var widthPercent = 90.0
    @AppStorage("reader.rememberProgress") private var rememberProgress = true

    @State private var cacheCleared = false

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("设置")
                    .font(.title3)
                    .bold()
                Spacer()
                Button("完成") { dismiss() }
                    .keyboardShortcut(.defaultAction)
            }
            .padding(.horizontal, Theme.Spacing.generous)
            .padding(.vertical, Theme.Spacing.standard)

            Divider()

            Form {
                Section {
                    LabeledContent("名称", value: model.root?.displayName ?? "未设置")
                    LabeledContent("路径") {
                        Text(model.root?.path ?? "未设置")
                            .lineLimit(1)
                            .truncationMode(.middle)
                            .foregroundStyle(.secondary)
                    }

                    HStack(spacing: Theme.Spacing.standard) {
                        Button("更换漫画库…", systemImage: "arrow.triangle.swap") {
                            model.chooseLibraryRoot()
                        }
                        Button("在 Finder 中显示", systemImage: "folder") {
                            model.revealLibraryInFinder()
                        }
                        .disabled(model.root == nil)

                        Button("立即同步", systemImage: "arrow.clockwise") {
                            Task { await model.sync() }
                        }
                        .disabled(model.isScanning || model.root == nil)
                    }
                    .padding(.top, Theme.Spacing.tight)
                } header: {
                    Label("漫画库", systemImage: "books.vertical.fill")
                }

                Section {
                    Picker("翻页模式", selection: $readerMode) {
                        Text("单页翻页").tag(ReaderMode.paged.rawValue)
                        Text("纵向滚动").tag(ReaderMode.scroll.rawValue)
                    }
                    .pickerStyle(.segmented)

                    Picker("页面宽度", selection: $widthMode) {
                        Text("适应窗口").tag(ReaderWidthMode.fit.rawValue)
                        Text("固定比例").tag(ReaderWidthMode.fixed.rawValue)
                    }
                    .pickerStyle(.segmented)

                    if widthMode == ReaderWidthMode.fixed.rawValue {
                        LabeledContent("缩放比例 (\(Int(widthPercent))%)") {
                            Slider(value: $widthPercent, in: 50...100, step: 5)
                                .frame(maxWidth: 200)
                        }
                    }

                    Toggle("自动记忆上次阅读进度", isOn: $rememberProgress)
                } header: {
                    Label("阅读器首选项", systemImage: "book.fill")
                }

                Section {
                    LabeledContent("缩略图与封面缓存") {
                        Button(cacheCleared ? "已清除缓存" : "清除本地缓存") {
                            Task {
                                await ThumbnailService.shared.clearMemory()
                                await ThumbnailService.shared.clearDisk()
                                await model.service?.coverResolver.clear()
                                cacheCleared = true
                            }
                        }
                        .disabled(cacheCleared)
                    }
                } header: {
                    Label("性能与缓存", systemImage: "internaldrive.fill")
                }

                Section {
                    LabeledContent("版本", value: "0.8.0 (macOS 原生架构)")
                    LabeledContent("全局数据库") {
                        Text(AppPaths.legacyDatabaseURL.path)
                            .font(.caption)
                            .lineLimit(1)
                            .truncationMode(.middle)
                            .foregroundStyle(.secondary)
                    }
                    LabeledContent("来源元数据") {
                        Text(AppPaths.sourceMetadataRoot.path)
                            .font(.caption)
                            .lineLimit(1)
                            .truncationMode(.middle)
                            .foregroundStyle(.secondary)
                    }
                } header: {
                    Label("关于与元数据", systemImage: "info.circle.fill")
                }
            }
            .formStyle(.grouped)
        }
        .frame(width: 580, height: 600)
    }
}
