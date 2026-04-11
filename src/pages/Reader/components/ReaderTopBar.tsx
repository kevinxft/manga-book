import type { MouseEvent } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, FolderOpen, Images, Plus, Trash2 } from 'lucide-react';

interface ReaderTopBarProps {
  title: string;
  folderPath: string;
  isReference?: boolean;
  tags?: { id: string; name: string }[];
  onBack: () => void;
  onOpenPreviousManga?: () => void;
  onOpenNextManga?: () => void;
  canOpenPreviousManga?: boolean;
  canOpenNextManga?: boolean;
  onOpenTagEditor?: (event: MouseEvent<HTMLButtonElement>) => void;
  onOpenPageEditor?: () => void;
  onOpenFolder?: () => void;
  onDeleteManga?: () => void;
  deleting?: boolean;
}

export function ReaderTopBar({
  title,
  folderPath,
  isReference = false,
  tags = [],
  onBack,
  onOpenPreviousManga,
  onOpenNextManga,
  canOpenPreviousManga = false,
  canOpenNextManga = false,
  onOpenTagEditor,
  onOpenPageEditor,
  onOpenFolder,
  onDeleteManga,
  deleting = false
}: ReaderTopBarProps) {
  return (
    <header className="app-window-drag app-page-titlebar absolute inset-x-0 top-0 z-30 flex h-16 items-center border-b border-white/5 bg-[#0f1115]/80 px-6 backdrop-blur-xl shadow-sm">
      <div className="flex min-w-0 flex-1 items-center gap-4 pr-4">
        <button
          className="group inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-white/5 px-3 pr-3.5 text-[11px] font-medium tracking-wide text-[#dce2ec] ring-1 ring-white/10 transition-all duration-200 hover:bg-white/15 hover:text-white focus:outline-none"
          onClick={onBack}
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          返回
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {isReference ? (
              <span
                className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]"
                title="当前漫画不在作者目录下"
              />
            ) : null}
            <p className="truncate text-[14px] font-bold tracking-wide text-white drop-shadow-md">{title}</p>
            {onOpenFolder ? (
              <button
                className="group flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white/5 text-[#8c9bab] ring-1 ring-white/10 transition-all hover:bg-[#3d7cf9] hover:text-white hover:ring-[#3d7cf9] focus:outline-none"
                onClick={onOpenFolder}
                title={`在文件管理器中打开:\n${folderPath}`}
              >
                <FolderOpen className="h-3 w-3 transition-transform group-hover:scale-110" />
              </button>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 overflow-hidden">
            {tags.map((tag) => (
              <span
                key={tag.id || tag.name}
                className="max-w-[120px] truncate rounded-md bg-[#2f7fe6]/15 px-1.5 py-0.5 text-[10px] font-medium text-[#7dace6] ring-1 ring-[#2f7fe6]/30"
                title={tag.name}
              >
                {tag.name}
              </span>
            ))}
            {onOpenTagEditor ? (
              <button
                className="group flex h-4 items-center justify-center rounded-md bg-white/5 px-1.5 text-[#8c9bab] ring-1 ring-white/10 transition-all hover:bg-[#2f8f68] hover:text-white hover:ring-[#2f8f68] focus:outline-none"
                onClick={onOpenTagEditor}
                title="编辑标签"
              >
                <Plus className="h-3 w-3" />
                {tags.length === 0 && <span className="ml-1 text-[10px] font-medium">添加标签</span>}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="ml-4 flex shrink-0 items-center gap-2.5">
        {onDeleteManga ? (
          <button
            className="group inline-flex h-8 items-center gap-1 rounded-full bg-white/5 px-3 pr-3.5 text-[11px] font-medium tracking-wide text-[#dce2ec] ring-1 ring-white/10 transition-all duration-200 hover:bg-white/15 hover:text-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white/5 disabled:hover:text-[#dce2ec]"
            onClick={onDeleteManga}
            disabled={deleting}
            title="移入回收站"
          >
            <Trash2 className="h-3 w-3 transition-transform group-hover:scale-110" />
            {deleting ? '移动中...' : '回收站'}
          </button>
        ) : null}



        {onOpenPageEditor ? (
          <button
            className="group inline-flex h-8 items-center gap-1 rounded-full bg-white/5 px-3 pr-3.5 text-[11px] font-medium tracking-wide text-[#dce2ec] ring-1 ring-white/10 transition-all duration-200 hover:bg-white/15 hover:text-white focus:outline-none"
            onClick={onOpenPageEditor}
            title="编辑漫画页面"
          >
            <Images className="h-3 w-3 transition-transform group-hover:scale-110" />
            整理
          </button>
        ) : null}

        <div className="mx-1 h-5 w-px bg-white/10" />

        <button
          className="group inline-flex h-8 items-center gap-1 rounded-full bg-white/5 px-3 pr-3.5 text-[11px] font-medium tracking-wide text-[#dce2ec] ring-1 ring-white/10 transition-all duration-200 hover:bg-white/15 hover:text-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/5 disabled:hover:text-[#dce2ec]"
          onClick={onOpenPreviousManga}
          disabled={!canOpenPreviousManga}
          title="上一本漫画"
        >
          <ChevronLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5 group-disabled:translate-x-0" />
          上一本
        </button>
        <button
          className="group inline-flex h-8 items-center gap-1 rounded-full bg-white/5 pl-3.5 pr-3 text-[11px] font-medium tracking-wide text-[#dce2ec] ring-1 ring-white/10 transition-all duration-200 hover:bg-white/15 hover:text-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/5 disabled:hover:text-[#dce2ec]"
          onClick={onOpenNextManga}
          disabled={!canOpenNextManga}
          title="下一本漫画"
        >
          下一本
          <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-disabled:translate-x-0" />
        </button>
      </div>
    </header>
  );
}
