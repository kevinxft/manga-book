# 漫书 · macOS 原生版

这是 Electron 版「漫书」的 Swift / AppKit 重写。核心目标不是“换语言”，而是把上一版
SwiftUI 卡顿的三个根因换掉：

1. 大列表不再用 `LazyVGrid + AsyncImage`，改用 `NSCollectionView` + diffable data source；
2. 封面走 ImageIO 降采样 + 内存/磁盘双层缓存，滚动时不会反复取消、重启解码；
3. 扫描和写库全部在后台执行，批量写入单事务提交，主线程只接收进度。

数据层与 Electron 版**字节级兼容**：直接复用现有 `mangabook.db` 与
`source-metadata/<SHA1>/metadata.db`，不重建库、不丢阅读进度。

---

## 目录结构

```
native/
├── Package.swift                  # MangaBookCore SPM 包（GRDB 7）
├── Sources/
│   ├── MangaBookCore/             # 数据层 / 扫描器 / 缩略图 / 阅读器 / 整理逻辑
│   ├── MangaBookProbe/            # 只读探针：打印真实库统计，用于排查数据问题
│   └── MangaBookSelfTest/         # 隔离自测：在临时目录跑完整业务流程
├── MangaBook/
│   ├── project.yml                # XcodeGen 工程定义
│   ├── Resources/                 # App 图标、漫画库文件夹图标
│   └── Sources/                   # SwiftUI 壳 + AppKit 网格/阅读器
├── build.sh                       # 构建脚本
└── run.sh                         # 构建并启动 Debug 版
```

## 构建与运行

依赖：macOS 15+、Xcode 27、`xcodegen`（`brew install xcodegen`）。

```sh
cd native
./run.sh                 # Debug 构建并启动
./build.sh release       # Release 构建，产物路径会打印出来
```

手动方式：

```sh
cd native/MangaBook
xcodegen generate
xcodebuild -project MangaBook.xcodeproj -scheme MangaBook \
  -configuration Release -derivedDataPath ../.build-xcode \
  CODE_SIGNING_ALLOWED=NO build
open ../.build-xcode/Build/Products/Release/MangaBook.app
```

首次运行访问 `~/Documents` 时，macOS 会弹一次 TCC 授权（App 未启用沙盒，这是系统对
“文稿”目录的保护）。允许后即可正常扫描。

> 不建议 Electron 版和原生版同时执行“同步/整理”写操作。两边都用 WAL，读写本身不会
> 损坏，但并发写入会让彼此的界面状态短暂不同步。

## 数据兼容

| 数据 | 路径 / 规则 |
|---|---|
| 全局库 | `~/Library/Application Support/MangaBook/mangabook.db`，`user_version=3` |
| 来源元数据 | `~/Library/Application Support/MangaBook/source-metadata/<SHA1(规范化库路径)>/metadata.db`，`user_version=1` |
| 路径存储 | 来源库内只存 `relative_path`；绝对路径由库根拼接 |
| 标签 ID | 确定性 `tag:<小写名>` |
| 阅读器章节 | `source_metadata` 表中的 `reader_manual_chapters:<id>` / `reader_chapter_metadata:<id>` JSON |
| 扫描规则 | ≥4 张图 = 单卷；`Authors/<作者>/<作品>/` 下 ≥2 个含图子目录 = 多卷；封面取普通字符串排序后的第一张图 |

扫描器保留原有语义：没有 mtime 增量，每次同步全量重扫；清理只依赖“磁盘路径集合 −
数据库路径集合”的差集；目录读取失败时保留原记录。

## 已实现

**图书馆**
- 网格浏览（`NSCollectionView`，178×268 卡片，封面按 512px 降采样）
- 搜索标题/路径、5 种排序、作者/未分类/标签筛选
- 多选、右键菜单、双击进入阅读器
- 同步进度、取消同步、状态栏统计
- 新建/更换漫画库、应用文件夹图标、导入漫画到未分类

**阅读器（独立窗口）**
- 单页翻页 / 纵向滚动两种模式
- 鼠标左键下一页、右键上一页；空格/方向键/PageUp/PageDown/A/W/S/D/F/Esc
- 记忆阅读进度（280ms 防抖写库）
- 宽度适应/固定百分比（50–100%）
- 章节面板：跳转、新增章节、重命名、高亮、删除
- 页面管理：缩略图网格多选、移到废纸篓、至少保留 1 页
- 标签编辑、在 Finder 中显示、删除漫画

**整理中心**
- 作者目录统计（漫画数、最近移动时间）
- 新建、重命名、合并、删除作者目录
- 批量移动到作者目录（含新建作者）
- 从外部目录导入漫画到作者目录
- 作者别名管理

**标签 / 书签**
- 标签：新增、替换、移除、删除、清空；标签筛选
- 书签：数据层完整（创建/更新/删除/按漫画查询），暂未做阅读器 UI

## 架构要点

- `MangaBookCore`：纯 Swift Package，不依赖 UI。GRDB 负责 SQLite，扫描器是
  `nonisolated async`，每 25 个目录让出一次执行权；写库按 100 条一批提交。
- `CoverResolver`：actor，5 分钟 TTL，负责“第一张图/第一个含图子目录”的封面解析。
- `ThumbnailService`：actor，`CGImageSourceCreateThumbnailAtIndex` 降采样，
  `NSCache` 内存缓存 + `~/Library/Caches/MangaBook/thumbnails` 磁盘缓存，缓存键包含
  文件 mtime 与大小。
- `PageImageCache`：阅读器页面解码缓存，限制 18 张，避免一次解 300 页 OOM。
- 网格：`NSCollectionViewDiffableDataSource`，内容签名不变时跳过快照更新，选中变化
  不会触发整页重载。
- 无 App Sandbox：需要扫描任意目录，走裸路径（与 Electron 版一致）。

## 自测

```sh
cd native
swift run MangaBookSelfTest
```

自测在系统临时目录创建一个 `Test.mangalibrary`，覆盖：扫描识别、封面选择、进度保留、
失效记录清理、多卷页序/章节、手工章节增删改、移动/重命名/合并/导入/删除作者目录、
标签、书签、删除漫画。不会读写真实漫画库。

只读检查真实库：

```sh
swift run MangaBookProbe
```

## 已知差异 / 后续

- 阅读器跨漫画边界跳转（Electron 的 boundary suggestions）尚未实现。
- 书签只有数据层，阅读器里还没有书签面板。
- 旧版全局库 → 来源库的迁移逻辑未复刻；当前数据已经迁移完成，直接可用。若要把
  只被旧版 Electron 使用过的库接进来，需要补 `legacy_migration_complete` 那套迁移。
- 签名/公证、DMG 打包未做；目前是本地 Debug/Release `.app`。
- 阅读器章节面板的“仅作者目录漫画可编辑”限制简化成了“单卷即可编辑”。
- `organizer.moveManga` 仍是“先移动文件、后写库”，与 Electron 版一致；目标始终在
  库内时不会出问题。

## 性能建议

- 1 万本级别时，首次扫描仍是全量目录遍历；瓶颈在文件系统而非 SQLite。
- 缩略图首次滚动会触发解码，之后命中内存/磁盘缓存；不要随意调用“清除缓存”。
- 如果后续要支持 5 万本以上，建议给 `manga_books` 增加分页查询接口，并把
  `allBooks` 换成按作者/来源分段加载；当前 2000–10000 本规模一次性载入是可接受的。
