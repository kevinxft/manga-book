# MangaBook Electron 重构实施计划

> 版本：v1.0 | 日期：2026-03-01 | 参考文档：PRD.md

---

## 一、技术栈确认

| 层级 | 技术选型 | 说明 |
|------|---------|------|
| 应用框架 | Electron 33+ | 主/渲染进程分离 |
| UI 框架 | React 19 + TypeScript | 渲染进程 |
| 状态管理 | Zustand | 轻量，适合局部状态 |
| 数据库 | better-sqlite3 | 同步 API，主进程专用 |
| 构建工具 | Vite + electron-vite | 开发热更新 + 生产打包 |
| 样式 | CSS Modules / Vanilla CSS | 避免运行时开销 |
| 虚拟列表 | @tanstack/react-virtual | 大列表性能保障 |
| 文件操作 | Node.js fs + trash | 回收站删除 |
| IPC 类型安全 | 共享 types 包 | Main/Renderer 共用契约 |

---

## 二、目录结构

```
manga-book-electron/
├── electron/                  # Main 进程
│   ├── main.ts                # 入口，窗口管理
│   ├── db/
│   │   ├── schema.ts          # DDL + 初始化
│   │   ├── migrations/        # 版本迁移脚本
│   │   └── queries/           # 按模块分组的 SQL 查询
│   │       ├── manga.ts
│   │       ├── bookmark.ts
│   │       ├── tag.ts
│   │       └── alias.ts
│   ├── ipc/                   # IPC handler 注册
│   │   ├── index.ts
│   │   ├── library.ipc.ts
│   │   ├── organizer.ipc.ts
│   │   ├── reader.ipc.ts
│   │   └── bookmark.ipc.ts
│   ├── scanner/               # 文件系统扫描
│   │   ├── sourceScanner.ts   # 增量扫描逻辑
│   │   └── coverFinder.ts     # 封面图查找
│   ├── tasks/                 # 可取消后台任务
│   │   └── taskQueue.ts
│   └── utils/
│       ├── pathUtils.ts       # 路径规范化
│       └── fsUtils.ts         # 文件操作封装
├── src/                       # Renderer 进程
│   ├── main.tsx               # React 入口
│   ├── App.tsx                # 路由根组件
│   ├── pages/
│   │   ├── Library/
│   │   ├── Organizer/
│   │   ├── Reader/
│   │   └── Settings/
│   ├── components/            # 通用 UI 组件
│   ├── stores/                # Zustand stores
│   ├── hooks/                 # 自定义 hooks
│   └── ipc/                   # IPC 调用封装（类型安全）
│       └── client.ts
├── shared/                    # Main + Renderer 共享类型
│   └── types.ts               # MangaBook, Bookmark, IPC 契约等
└── electron.vite.config.ts
```

---

## 三、里程碑拆解

---

### M1：数据层 + 扫描器 + 图书馆只读

**目标**：能添加来源目录、扫描并展示漫画列表（含封面）。

#### M1.1 项目脚手架
- [ ] 使用 `electron-vite` 初始化项目
- [ ] 配置 TypeScript 严格模式
- [ ] 配置 `shared/types.ts`（全量实体类型 + IPC 契约类型）
- [ ] 配置 ESLint + Prettier

#### M1.2 数据库层
- [ ] 实现 `db/schema.ts`：建表 DDL + 索引（按 PRD §6.2、§6.3）
- [ ] 实现数据库初始化（首次启动自动建表）
- [ ] 实现简单版本迁移机制（`user_version` pragma）
- [ ] 实现各模块 query 函数：
  - `manga.ts`：insert / updatePath / delete / listBySource / search
  - `tag.ts`：upsert / listByManga / deleteOrphan
  - `bookmark.ts`：insert / update / delete / listByManga
  - `alias.ts`：insert / resolve / list

#### M1.3 文件扫描器
- [ ] `sourceScanner.ts`：
  - 遍历来源目录，识别单卷 vs 多卷结构
  - 增量扫描：仅处理新增/变更/删除的目录
  - 扫描结果写入 `manga_books` 表
- [ ] `coverFinder.ts`：
  - 查找目录内第一张图（支持 `.jpg .jpeg .png .webp`）
  - 实现内存级封面路径缓存（`Map<folderPath, coverPath>`）
- [ ] `taskQueue.ts`：
  - 支持任务入队、并发上限（默认 4）、取消、进度回调

#### M1.4 IPC 层（Library）
- [ ] 实现 `library.ipc.ts`：
  - `library.addSource(path)` → 写 `library_folders` + 触发扫描
  - `library.removeSource(id)` → 删除来源（不删漫画文件，仅 DB）
  - `library.syncSources()` → 触发增量扫描任务
  - `library.listMangas(filter)` → 支持搜索/排序/来源过滤
  - `library.getScanProgress()` → 返回当前扫描进度

#### M1.5 Renderer：图书馆只读 UI
- [ ] 实现路由结构（Library / Organizer / Reader / Settings）
- [ ] `Library` 页面：
  - 来源目录管理侧边栏（添加/移除）
  - 虚拟化漫画网格（@tanstack/react-virtual）
  - 封面懒加载（`IntersectionObserver` + IPC 获取封面路径）
  - 搜索框（标题/标签/路径）
  - 排序下拉（标题 / 添加时间 / 最近阅读）
  - 右键菜单占位（打开/移动/重命名/标签/删除，M2 实现）
  - 同步进度条（扫描中时显示）

**M1 验收**：添加 1 个来源目录 → 扫描 → 展示列表 → 搜索生效。

---

### M2：整理中心（移动 / 重命名 / 删除 / 目录管理）

**目标**：核心整理操作全部可用，对应 PRD §5.2。

#### M2.1 IPC 层（Organizer）
- [ ] `organizer.ipc.ts`：
  - `organizer.moveManga(mangaId, destinationPath)` → 先 `fs.rename`，成功后更新 DB `folder_path`
  - `organizer.renameManga(mangaId, newTitle)` → 先重命名文件夹，成功后更新 DB
  - `organizer.deleteManga(mangaId, withFiles)` → `trash(folderPath)` + DB 事务
  - `organizer.createTargetDirectory(location, name, aliases[])` → `fs.mkdir` + 写 DB + 刷新缓存
  - `organizer.listTargetDirectories()` → 返回 `TargetDirectorySummary[]`（含漫画本数）
  - `organizer.batchMove(mangaIds[], destinationPath)` → 串行执行 moveManga

#### M2.2 目录别名（Alias）
- [ ] `alias.ipc.ts`（或合并到 organizer）：
  - `alias.create(alias, canonicalName)`
  - `alias.delete(id)`
  - `alias.list()`
  - `alias.resolve(name)` → 返回 canonical name
- [ ] 路径提取移动逻辑：从漫画标题/路径提取 Artist 名 → alias 解析 → 生成目标路径

#### M2.3 Renderer：整理中心 UI
- [ ] `Organizer` 页面布局：左侧目录树 + 右侧漫画列表
- [ ] 目录树：
  - 展示 `Artists / Series / Inbox` 固定根
  - 展示子目录及漫画本数
  - 支持新建目录（弹窗，含别名输入）
- [ ] 漫画列表：
  - 多选（Checkbox + Shift 区间选）
  - 批量移动：选目标目录后确认
  - 右键菜单：快速移动 / 重命名 / 删除 / 打标签
  - 快速移动：弹出目标目录选择器（搜索过滤）
  - 路径提取移动：解析 → 预览结果 → 确认执行
- [ ] 来源目录多选过滤（顶部 Tab / Chips）

**M2 验收**：移动/重命名/删除/批量移动/新建目录全流程通过，DB 与文件系统状态一致。

---

### M3：阅读器 + 书签 + 标签 + 设置

**目标**：完整阅读体验，对应 PRD §5.3、§5.4、§5.5。

#### M3.1 IPC 层（Reader）
- [ ] `reader.ipc.ts`：
  - `reader.open(mangaId)` → 返回章节列表 + 续读位置
  - `reader.getPagePaths(mangaId, chapterIndex)` → 返回页面图片路径数组
  - `reader.saveProgress(mangaId, chapterIndex, pageIndex, totalPages)`

#### M3.2 IPC 层（Bookmark）
- [ ] `bookmark.ipc.ts`：
  - `bookmark.create(mangaId, chapterIndex, pageIndex, title, note)`
  - `bookmark.update(id, title, note)`
  - `bookmark.delete(id)`
  - `bookmark.listByManga(mangaId)`

#### M3.3 Renderer：阅读器 UI
- [ ] 全屏横向翻页视图（RTL/LTR 可切换）
- [ ] 顶部/底部工具栏（章节选择、页面跳转、书签、退出）
- [ ] 书签侧边栏：列表 + 跳转 + 删除
- [ ] 自动续读（打开漫画时恢复上次位置）
- [ ] 键盘快捷键：方向键翻页，`B` 添加书签，`Esc` 退出

#### M3.4 标签系统 UI
- [ ] 快速打标签弹窗（搜索已有标签 + 创建新标签）
- [ ] 标签编辑器（`Settings` 或独立面板）：列表 + 重命名 + 删除
- [ ] 标签筛选（Library 侧边栏显示标签过滤器）

#### M3.5 外部搜索
- [ ] 右键菜单「外部搜索」子菜单：Hitomi / ExHentai / Google
- [ ] 调用 `shell.openExternal(url)` 打开系统浏览器

#### M3.6 设置页
- [ ] 翻页方向（RTL/LTR）
- [ ] 默认背景色（黑/白）
- [ ] 性能策略：封面懒加载开关、扫描并发数
- [ ] 设置持久化：读写 `app_settings` 表

**M3 验收**：可完整阅读漫画、添加书签并跳转、标签打标筛选、设置持久化生效。

---

### M4：性能优化 + 迁移工具 + 回归测试

**目标**：在大库（5000 本+）下达到 PRD §9 性能指标。

#### M4.1 性能优化
- [ ] 虚拟列表压测（5000 项，滚动 FPS 监测）
- [ ] 扫描任务分批处理，避免主线程阻塞
- [ ] IPC 读操作增加内存缓存层（LRU，按需失效）
- [ ] 封面图缩略图生成（`sharp`，仅存缩略图路径，懒生成）
- [ ] DB 慢查询分析，添加缺失索引

#### M4.2 从 SwiftUI 版迁移
- [ ] 编写迁移脚本 `scripts/migrate-from-swift.ts`：
  - 读取现有来源目录，重新扫描重建 DB（推荐方案）
  - 可选：解析旧版数据导出文件（若存在）
  - 双重校验：DB 记录路径存在性 + 去重

#### M4.3 回归测试
- [ ] 单元测试：DB query 函数（vitest）
- [ ] 单元测试：路径规范化、扫描器逻辑
- [ ] 集成测试：关键 IPC 命令（electron-test + 测试用 DB）
- [ ] 手动测试清单：覆盖所有核心用户故事（§4）

---

## 四、关键设计决策备忘

### IPC 类型安全
```ts
// shared/types.ts 中定义所有 IPC channel
export type IpcChannels = {
  'library.addSource': { req: { path: string }, res: LibraryFolder };
  'library.listMangas': { req: MangaFilter, res: MangaBook[] };
  // ...
};

// 封装成类型安全调用
export function ipcInvoke<K extends keyof IpcChannels>(
  channel: K,
  req: IpcChannels[K]['req']
): Promise<IpcResult<IpcChannels[K]['res']>>;
```

### 文件操作原则（对应 PRD §8）
```
重命名：fs.rename(oldPath, newPath) → 成功 → db.update(folder_path)
删除：  trash(folderPath)            → 成功 → db.transaction(() => deleteAll)
新建目录：fs.mkdir → 成功 → db.insert + 立即刷新目录候选缓存
```

### 增量扫描逻辑
```
1. 读取 DB 中该 source 下所有 folder_path
2. 遍历文件系统，得到当前所有子目录集合
3. 新增 = 文件系统有 / DB 没有 → insert
4. 删除 = DB 有 / 文件系统没有 → 标记或删除
5. 不做全量覆盖写入
```

---

## 五、风险与应对

| 风险 | 影响 | 应对 |
|------|------|------|
| Electron 主进程 SQLite 操作阻塞 | 列表操作卡顿 | 使用 Worker Thread 或异步分批查询 |
| 文件系统操作与 DB 不一致 | 数据错乱 | 文件操作先行，失败则不更新 DB |
| 大库封面加载慢 | 首屏体验差 | 懒加载 + 缩略图预生成 |
| 目录扫描中途应用退出 | 扫描状态丢失 | 扫描结果实时持久化，重启可续 |
| Windows/Linux 路径兼容 | 跨平台问题 | 统一使用 `path.posix` 规范化 |

---

## 六、开发顺序建议

```
M1.1 脚手架 → M1.2 DB 层 → M1.3 扫描器 → M1.4 IPC → M1.5 UI
    ↓
M2.1 Organizer IPC → M2.2 别名 → M2.3 UI
    ↓
M3.1 Reader IPC → M3.3 阅读器 UI → M3.2 书签 IPC → M3.4 标签 → M3.6 设置
    ↓
M4.1 性能 → M4.2 迁移 → M4.3 测试
```

> 每个子任务完成后，应确保其对应 IPC handler 有基本测试覆盖，防止后续 M2/M3 引入回归。
