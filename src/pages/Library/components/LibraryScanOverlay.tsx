import { Loader2 } from 'lucide-react';
import type { ScanProgress } from '@shared/types';

interface LibraryScanOverlayProps {
  progress: ScanProgress;
}

function getScanPercent(progress: ScanProgress): number {
  if (progress.total <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round((progress.current / progress.total) * 100)));
}

export function LibraryScanOverlay({ progress }: LibraryScanOverlayProps) {
  if (progress.status !== 'running') {
    return null;
  }

  const scanPercent = getScanPercent(progress);

  return (
    <>
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#1f2b3d]/18 backdrop-blur-[1px]">
        <div className="w-[320px] rounded-2xl border border-[#d9e2f2] bg-white px-5 py-4 shadow-[0_18px_42px_rgba(35,64,112,0.25)]">
          <div className="mb-3 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-[#2f6cf6]" />
            <p className="text-sm font-bold text-[#1f2b3d]">正在扫描漫画目录...</p>
          </div>
          <p className="truncate text-xs text-[#67758b]">{progress.message}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#dbe3f3]">
            <div className="h-full rounded-full bg-[#2f6cf6] transition-all" style={{ width: `${scanPercent}%` }} />
          </div>
          <p className="mt-2 text-right text-xs font-semibold text-[#2f6cf6]">
            {progress.total > 0 ? `${progress.current}/${progress.total}` : '--'} ({scanPercent}%)
          </p>
        </div>
      </div>

      <div className="h-1 w-full bg-[#d6dff4]">
        <div className="h-full bg-[#2f6cf6] transition-all" style={{ width: `${scanPercent}%` }} />
      </div>
    </>
  );
}
