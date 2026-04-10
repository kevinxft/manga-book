import { ArrowLeft, ChevronLeft, ChevronRight, Images, Trash2 } from 'lucide-react';

interface ReaderTopBarProps {
  title: string;
  folderPath: string;
  onBack: () => void;
  onOpenPreviousManga?: () => void;
  onOpenNextManga?: () => void;
  canOpenPreviousManga?: boolean;
  canOpenNextManga?: boolean;
  onOpenPageEditor?: () => void;
  onDeleteManga?: () => void;
  deleting?: boolean;
}

export function ReaderTopBar({
  title,
  folderPath,
  onBack,
  onOpenPreviousManga,
  onOpenNextManga,
  canOpenPreviousManga = false,
  canOpenNextManga = false,
  onOpenPageEditor,
  onDeleteManga,
  deleting = false
}: ReaderTopBarProps) {
  return (
    <header className="app-window-drag app-page-titlebar absolute inset-x-0 top-0 z-30 flex h-16 items-center border-b border-white/5 bg-[#0f1115]/80 px-6 backdrop-blur-xl shadow-sm">
      <div className="flex min-w-0 flex-1 items-center gap-4 pr-4">
        <button
          className="group inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-white/5 px-3.5 pr-4 text-[12px] font-medium tracking-wide text-[#dce2ec] ring-1 ring-white/10 transition-all duration-200 hover:bg-white/15 hover:text-white focus:outline-none"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          返回
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold tracking-wide text-white drop-shadow-md">{title}</p>
          <p className="mt-0.5 truncate text-[11px] font-medium text-[#8c9bab]">{folderPath}</p>
        </div>
      </div>

      <div className="ml-4 flex shrink-0 items-center gap-2.5">
        {onDeleteManga ? (
          <button
            className="group inline-flex h-9 items-center gap-1.5 rounded-full bg-red-500/10 px-3.5 pr-4 text-[12px] font-medium tracking-wide text-red-300 ring-1 ring-red-500/20 transition-all duration-200 hover:bg-red-500/20 hover:text-red-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onDeleteManga}
            disabled={deleting}
            title="删除当前漫画"
          >
            <Trash2 className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />
            {deleting ? '删除中...' : '删除'}
          </button>
        ) : null}
        
        {onOpenPageEditor ? (
          <button
            className="group inline-flex h-9 items-center gap-1.5 rounded-full bg-white/5 px-3.5 pr-4 text-[12px] font-medium tracking-wide text-[#dce2ec] ring-1 ring-white/10 transition-all duration-200 hover:bg-[#3d7cf9] hover:text-white hover:ring-[#3d7cf9] hover:shadow-[0_0_12px_rgba(61,124,249,0.3)] focus:outline-none"
            onClick={onOpenPageEditor}
            title="编辑漫画页面"
          >
            <Images className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />
            整理
          </button>
        ) : null}

        <div className="mx-1 h-5 w-px bg-white/10" />

        <button
          className="group inline-flex h-9 items-center gap-1.5 rounded-full bg-white/5 px-3.5 pr-4 text-[12px] font-medium tracking-wide text-[#dce2ec] ring-1 ring-white/10 transition-all duration-200 hover:bg-white/15 hover:text-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/5 disabled:hover:text-[#dce2ec]"
          onClick={onOpenPreviousManga}
          disabled={!canOpenPreviousManga}
          title="上一本漫画"
        >
          <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5 group-disabled:translate-x-0" />
          上一本
        </button>
        <button
          className="group inline-flex h-9 items-center gap-1.5 rounded-full bg-white/5 pl-4 pr-3.5 text-[12px] font-medium tracking-wide text-[#dce2ec] ring-1 ring-white/10 transition-all duration-200 hover:bg-white/15 hover:text-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/5 disabled:hover:text-[#dce2ec]"
          onClick={onOpenNextManga}
          disabled={!canOpenNextManga}
          title="下一本漫画"
        >
          下一本
          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-disabled:translate-x-0" />
        </button>
      </div>
    </header>
  );
}
