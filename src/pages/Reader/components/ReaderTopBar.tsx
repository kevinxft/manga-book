import { ArrowLeft, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';

interface ReaderTopBarProps {
  title: string;
  folderPath: string;
  onBack: () => void;
  onOpenPreviousManga?: () => void;
  onOpenNextManga?: () => void;
  canOpenPreviousManga?: boolean;
  canOpenNextManga?: boolean;
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
  onDeleteManga,
  deleting = false
}: ReaderTopBarProps) {
  return (
    <header className="absolute inset-x-0 top-0 z-30 flex h-14 items-center border-b border-black/45 bg-[rgba(0,0,0,0.52)] px-4">
      <div className="flex min-w-0 flex-1 items-center gap-3 pr-2">
        <button
          className="inline-flex h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-black/50 bg-[rgba(20,20,24,0.58)] px-3 text-xs font-semibold text-[#e3e5ea] transition hover:bg-[rgba(29,29,35,0.72)]"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
          返回
        </button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{title}</p>
          <p className="truncate text-[11px] text-[#7b8191]">{folderPath}</p>
        </div>
      </div>

      <div className="ml-3 flex shrink-0 items-center gap-2">
        {onDeleteManga ? (
          <button
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-red-400/30 bg-[rgba(92,24,24,0.62)] px-3 text-xs font-semibold text-[#ffd6d6] transition hover:bg-[rgba(120,29,29,0.76)] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onDeleteManga}
            disabled={deleting}
            title="删除当前漫画"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {deleting ? '删除中' : '删除'}
          </button>
        ) : null}
        <button
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-black/50 bg-[rgba(20,20,24,0.58)] px-3 text-xs font-semibold text-[#e3e5ea] transition hover:bg-[rgba(29,29,35,0.72)] disabled:cursor-not-allowed disabled:opacity-40"
          onClick={onOpenPreviousManga}
          disabled={!canOpenPreviousManga}
          title="上一本漫画"
        >
          <ChevronLeft className="h-4 w-4" />
          上一本
        </button>
        <button
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-black/50 bg-[rgba(20,20,24,0.58)] px-3 text-xs font-semibold text-[#e3e5ea] transition hover:bg-[rgba(29,29,35,0.72)] disabled:cursor-not-allowed disabled:opacity-40"
          onClick={onOpenNextManga}
          disabled={!canOpenNextManga}
          title="下一本漫画"
        >
          下一本
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
