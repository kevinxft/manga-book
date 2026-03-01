# MangaBook Electron 重构 PRD

## 1. 文档信息
- 版本：v1.0（Electron 重构版）
- 日期：2026-03-01
- 目标平台：macOS（首发），后续可扩展 Windows/Linux
- 技术方向：Electron + React + TypeScript + SQLite（本地离线）

---

## 2. 背景与目标

现有 SwiftUI 版本已验证业务可行，但在「大列表 + 高频状态变更 + 文件系统扫描」场景存在明显卡顿。目标是通过 Electron 重构，保留业务能力并提升可控性：

1. 保留现有核心能力：导入、整理、移动、重命名、删除、阅读、书签、标签、目录别名。
2. 明确数据结构与状态边界，避免 UI 层隐式重算导致性能抖动。
3. 以本地离线为前提，支持大规模漫画库（1 万本级别）可用。

---

## 3. 产品范围

### 3.1 In Scope（本期）
- 多来源目录导入与同步
- 图书馆浏览（搜索/排序/筛选）
- 整理中心（批量移动、路径提取移动、目录管理、别名）
- 阅读器（单卷/多卷、续读、书签）
- 标签系统
- 外部搜索（Hitomi / ExHentai / Google）
- 封面缓存与目录扫描缓存

### 3.2 Out of Scope（本期不做）
- 云同步
- 多端实时协同
- 在线漫画源抓取
- 用户账号系统

---

## 4. 关键用户与用户故事

### 用户类型
- 重度本地漫画用户（千本以上）
- 日常整理用户（经常重命名/移动/打标签）

### 核心用户故事
1. 我可以添加多个来源目录并统一浏览漫画。
2. 我可以将漫画快速移动到 Artists/Series/Inbox。
3. 我可以在阅读时记录书签并快速跳转。
4. 我可以通过标签和目录筛选快速定位漫画。
5. 我可以在性能可接受前提下执行批量操作（移动/删除/重命名）。

---

## 5. 功能需求

## 5.1 图书馆（Library）
- 添加/移除来源目录（Source）
- 同步来源目录（增量扫描）
- 漫画列表：封面、标题、标签、阅读进度、来源
- 搜索：标题/路径/标签
- 排序：标题 / 添加时间 / 最近阅读
- 右键操作：打开、移动、重命名、标签、删除

## 5.2 整理中心（Organizer）
- 固定根目录（包含 Artists / Series / Inbox）
- 来源目录多选过滤
- 批量整理（按分类移动）
- 快速移动（右键）
- 路径提取移动（从标题/路径提取作者）
- 目录别名管理（alias -> canonical）
- 目标目录视图：按目录统计「漫画本数」

## 5.3 阅读器（Reader）
- 单卷/多卷自动识别
- 横向翻页（后续可扩展纵向）
- 自动续读（章索引+页索引）
- 书签：增删改查 + 跳转

## 5.4 标签与搜索
- 快速打标签
- 标签编辑器
- 外部搜索：Hitomi / ExHentai / Google

## 5.5 设置（Settings）
- 翻页方向（RTL/LTR）
- 默认背景色（黑/白）
- 性能策略开关（可选：封面懒加载/扫描并发）

---

## 6. 数据结构（重点）

本重构统一使用 SQLite（建议 `better-sqlite3`），所有 UI 状态来自 DB + 明确缓存层，不依赖隐式计算属性。

## 6.1 核心实体（TypeScript）

```ts
export type MangaStructure = "singleVolume" | "multiVolume";

export interface MangaBook {
  id: string;                 // UUID
  title: string;
  folderPath: string;         // 规范化绝对路径
  sourceFolderPath: string;   // 来源目录绝对路径
  structure: MangaStructure;
  addedAt: string;            // ISO datetime
  lastReadAt: string | null;
  isFavorite: 0 | 1;
  lastChapterIndex: number;
  lastPageIndex: number;
  totalPages: number;
}

export interface LibraryFolder {
  id: string;                 // UUID
  path: string;               // 唯一，规范化绝对路径
  displayName: string;
  addedAt: string;
}

export interface MangaTag {
  id: string;
  name: string;               // 规范化后唯一（大小写不敏感）
  createdAt: string;
}

export interface MangaBookTag {
  mangaId: string;
  tagId: string;
  createdAt: string;
}

export interface Bookmark {
  id: string;
  mangaId: string;            // 不再用路径做外键，避免重命名/移动级联成本
  chapterIndex: number;
  pageIndex: number;
  chapterName: string;
  title: string;
  note: string;
  createdAt: string;
}

export interface DirectoryAlias {
  id: string;
  alias: string;              // 规范化后唯一
  canonicalName: string;
  createdAt: string;
}
```

## 6.2 SQLite 表结构（DDL）

```sql
CREATE TABLE manga_books (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  folder_path TEXT NOT NULL UNIQUE,
  source_folder_path TEXT NOT NULL,
  structure TEXT NOT NULL CHECK (structure IN ('singleVolume','multiVolume')),
  added_at TEXT NOT NULL,
  last_read_at TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  last_chapter_index INTEGER NOT NULL DEFAULT 0,
  last_page_index INTEGER NOT NULL DEFAULT 0,
  total_pages INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE library_folders (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  added_at TEXT NOT NULL
);

CREATE TABLE manga_tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE manga_book_tags (
  manga_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (manga_id, tag_id),
  FOREIGN KEY (manga_id) REFERENCES manga_books(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES manga_tags(id) ON DELETE CASCADE
);

CREATE TABLE bookmarks (
  id TEXT PRIMARY KEY,
  manga_id TEXT NOT NULL,
  chapter_index INTEGER NOT NULL,
  page_index INTEGER NOT NULL,
  chapter_name TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY (manga_id) REFERENCES manga_books(id) ON DELETE CASCADE
);

CREATE TABLE directory_aliases (
  id TEXT PRIMARY KEY,
  alias TEXT NOT NULL,
  alias_key TEXT NOT NULL UNIQUE,
  canonical_name TEXT NOT NULL,
  canonical_key TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

## 6.3 必要索引

```sql
CREATE INDEX idx_books_source ON manga_books(source_folder_path);
CREATE INDEX idx_books_title ON manga_books(title);
CREATE INDEX idx_books_last_read ON manga_books(last_read_at);
CREATE INDEX idx_bookmarks_manga ON bookmarks(manga_id);
CREATE INDEX idx_aliases_canonical_key ON directory_aliases(canonical_key);
```

## 6.4 文件系统约定
- 一个漫画 = 一个目录
- 支持图片：`.jpg .jpeg .png .webp`
- 单卷：目录直接包含图片
- 多卷：子目录包含图片
- 固定整理根下目录：
  - `Artists/<name>/...`
  - `Series/<name>/...`
  - `Inbox/...`

## 6.5 缓存结构（非持久主数据）

```ts
interface CoverPathCacheEntry {
  folderPath: string;
  coverPath: string | null;
  updatedAt: number;
}

interface TargetDirectorySummary {
  directory: string; // e.g. "Artists/xxx" or "Series/yyy"
  mangaCount: number;
}
```

缓存仅用于性能，不作为业务真相来源。

---

## 7. 进程架构与 IPC 契约

## 7.1 架构
- Main 进程：文件系统操作、SQLite、任务队列
- Renderer：React UI，仅调用 IPC，不直接操作文件系统
- Worker（可选）：扫描/缩略图/批处理任务

## 7.2 IPC 原则
- 所有写操作走 `command`（可审计）
- 所有读操作走 `query`（可缓存）
- 返回统一结构：`{ ok: boolean, data?: T, error?: { code, message } }`

## 7.3 关键命令
- `library.addSources(paths[])`
- `library.syncSources()`
- `organizer.normalize(batch)`
- `organizer.moveManga(mangaId, destination)`
- `organizer.renameManga(mangaId, newTitle)`
- `organizer.deleteManga(mangaId, withFiles)`
- `organizer.createTargetDirectory(location, name, aliases[])`
- `reader.saveProgress(mangaId, chapterIndex, pageIndex, totalPages)`
- `bookmark.create/update/delete`

---

## 8. 关键业务规则

1. `folder_path` 在全库唯一。
2. 书签必须通过 `manga_id` 关联，不允许通过路径字符串关联。
3. 重命名漫画 = 优先重命名文件夹，成功后再更新 DB。
4. 删除漫画 = 先文件操作（回收站），后 DB 事务提交。
5. 新建目录后需立即更新目录候选缓存，并异步强制刷新一次目录扫描。
6. 大列表刷新必须增量化；禁止在交互路径中做全量目录扫描。

---

## 9. 非功能需求（性能/稳定性）

- 5000 本漫画库下：
  - 打标签操作 UI 可交互延迟 < 100ms
  - 单本删除操作主线程阻塞 < 50ms
  - 列表滚动保持可用（目标 55fps+）
- 文件操作全部后台化，UI 只做状态提交
- 扫描任务默认低优先级，支持并发上限（例如 2~4）
- 所有批量任务可取消、可观测进度

---

## 10. 迁移策略（从现版本到 Electron）

1. 首次启动扫描现有来源目录重建 DB（推荐）
2. 可选导入旧数据（若可解析 SwiftData 导出）：
   - `MangaBook -> manga_books`
   - `Bookmark -> bookmarks`
   - `MangaTag + tagNames -> manga_tags + manga_book_tags`
   - `DirectoryAlias -> directory_aliases`
3. 双重校验：
   - DB 记录路径是否存在
   - 同一路径重复记录清理

---

## 11. 里程碑建议

- M1：数据层 + 扫描器 + 图书馆只读
- M2：整理中心（移动/重命名/删除/目录管理）
- M3：阅读器 + 书签 + 设置
- M4：性能优化与回归测试（大库压测）

---

## 12. 验收标准（DoD）

1. 功能对齐：现有核心流程可全量完成。
2. 数据可靠：文件操作与 DB 状态一致，无孤儿数据。
3. 性能达标：删除/重命名/打标签/滚动不出现明显卡顿。
4. 可维护：核心实体、表结构、IPC 契约文档齐全并可执行。
