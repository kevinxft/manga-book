# 漫书

漫书是一个本地漫画库应用，用来扫描、整理和阅读存放在 Mac 上的漫画。原生版使用 Swift、SwiftUI、AppKit 和 GRDB，浏览器扩展负责把 Hitomi 画册发送到本地 App。

## 项目组成

- `native/MangaBook/`：macOS App，按功能分为 `App`、`Library`、`Reader`、`Downloads`、`Organizer`、`Settings` 和 `Shared`。
- `native/Sources/MangaBookCore/`：可测试的数据与业务层，包含模型、数据库、仓库、扫描器、整理逻辑和下载逻辑。
- `native/Sources/MangaBookSelfTest/`：在临时目录运行的隔离自测。
- `extension/`：Chrome / Arc 浏览器扩展。

## 构建与使用

开发环境需要 macOS 15 或更高版本、Xcode 和 `xcodegen`。

```sh
cd native
./run.sh
```

Release 构建：

```sh
cd native
./build.sh release
```

完整使用说明、数据目录、签名流程和自测方式见 [native/README.md](native/README.md)。
