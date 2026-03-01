import { ArrowLeft } from 'lucide-react';

interface ReaderTopBarProps {
  title: string;
  folderPath: string;
  onBack: () => void;
}

export function ReaderTopBar({ title, folderPath, onBack }: ReaderTopBarProps) {
  return (
    <header className="absolute inset-x-0 top-0 z-30 flex h-14 items-center border-b border-black/45 bg-[rgba(0,0,0,0.52)] px-4">
      <div className="flex min-w-0 items-center gap-3 pr-2">
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
    </header>
  );
}
