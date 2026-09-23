# Manga Book

一个基于 Electron + React + TypeScript 的本地漫画管理与阅读器（桌面应用）。

## 特性

- 导入本地漫画目录，递归扫描并建立漫画库
- 支持 `Authors / Unsorted` 分类筛选；可在作者目录下整理系列
- 支持重新扫描、导入目录管理、重复目录自动跳过
- 漫画封面网格展示（含作者角标、页数）
- 阅读器支持：
  - 翻页模式 / 滚动模式
  - 适应宽度 / 固定宽度（百分比）
  - 键鼠快捷翻页（空格、方向键、WASD、鼠标左右键）
- 设置弹窗支持持久化保存：阅读模式、宽度模式、固定宽度百分比、翻页动画

## 技术栈

- Electron
- electron-vite
- React 19 + TypeScript
- Tailwind CSS
- Zustand
- better-sqlite3
- Bun（包管理与脚本运行）

## 开发环境

- Node.js 20.19+ 或 22.12+（Vite 7 要求）
- Bun 1.0+
- 当前主要在 macOS 下开发验证；Windows/Linux 尚未逐平台验证

## 快速开始

```bash
bun install
bun run dev
```

> 请使用 `bun run dev` 启动 Electron 窗口；直接用浏览器打开前端页面时 IPC 不可用。

## 常用脚本

```bash
# 启动开发环境（Electron + Renderer）
bun run dev

# 构建
bun run build

# 预览生产构建
bun run preview

# 类型检查
bun run typecheck

# 代码检查
bun run lint
```

## 项目结构

```text
electron/        # 主进程、IPC、扫描、数据库
shared/          # 前后端共享类型
src/             # 渲染进程（React UI）
```

## 数据说明

- 应用使用 SQLite 存储元数据（目录、漫画、阅读进度等）
- 漫画文件本体仍保留在你本地目录，不会复制到项目内

## 目录识别规则（当前实现）

- 漫画目录包含至少 4 张受支持图片时识别为单卷；作者目录下可按子目录识别多卷
- 支持 `Authors` 作者结构和 `Unsorted` 待整理目录
- 图片格式：`.jpg .jpeg .png .webp .avif .bmp .gif .heic .heif .tif .tiff`
- `Artists / Series / Inbox` 为早期规划命名，当前默认目录为 `Authors / Unsorted`
- 扫描时遇到目录读取错误会中止清理阶段，避免因部分扫描结果删掉漫画记录

## License

MIT
