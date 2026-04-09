import { ArrowLeft, Minus, Plus } from 'lucide-react';
import { cn } from '@renderer/lib/utils';
import type { ReaderMode, ReaderWidthMode } from '../types';

interface ReaderBottomBarProps {
  pageProgress: string;
  pageCount: number;
  currentPageIndex: number;
  canGoPrev: boolean;
  canGoNext: boolean;
  readerMode: ReaderMode;
  widthMode: ReaderWidthMode;
  widthLabel: string;
  canDecreaseWidth: boolean;
  canIncreaseWidth: boolean;
  onSliderChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onBack: () => void;
  onPrev: () => void;
  onNext: () => void;
  onReaderModeChange: (mode: ReaderMode) => void;
  onWidthModeChange: (mode: ReaderWidthMode) => void;
  onAdjustWidth: (delta: number) => void;
  onToolbarButtonMouseDown: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

export function ReaderBottomBar({
  pageProgress,
  pageCount,
  currentPageIndex,
  canGoPrev,
  canGoNext,
  readerMode,
  widthMode,
  widthLabel,
  canDecreaseWidth,
  canIncreaseWidth,
  onSliderChange,
  onBack,
  onPrev,
  onNext,
  onReaderModeChange,
  onWidthModeChange,
  onAdjustWidth,
  onToolbarButtonMouseDown
}: ReaderBottomBarProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-[760px] items-center gap-2 rounded-[18px] border border-black/45 bg-[rgba(0,0,0,0.72)] px-3 py-2.5 shadow-[0_18px_50px_rgba(0,0,0,0.42)]">
        <button
          className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[#dce2ec] transition hover:bg-white/10 focus:outline-none focus-visible:outline-none"
          onClick={onBack}
          onMouseDown={onToolbarButtonMouseDown}
          title="返回"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="text-[11px] font-semibold">返回</span>
        </button>

        <div className="h-4 w-px bg-white/14" />

        <span className="min-w-[62px] text-xs font-semibold text-[#e7eaf0]">{pageProgress}</span>
        <input
          type="range"
          min={1}
          max={Math.max(pageCount, 1)}
          value={Math.min(currentPageIndex + 1, Math.max(pageCount, 1))}
          onChange={onSliderChange}
          className="h-1.5 flex-1 cursor-pointer accent-[#2f6cf6]"
          aria-label="页面快速跳转"
        />

        <div className="mx-1 h-4 w-px bg-white/14" />

        <button
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#dce2ec] transition hover:bg-white/10 focus:outline-none focus-visible:outline-none disabled:opacity-40"
          onClick={onPrev}
          onMouseDown={onToolbarButtonMouseDown}
          disabled={!canGoPrev}
          title="上一页"
        >
          ‹
        </button>
        <button
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#dce2ec] transition hover:bg-white/10 focus:outline-none focus-visible:outline-none disabled:opacity-40"
          onClick={onNext}
          onMouseDown={onToolbarButtonMouseDown}
          disabled={!canGoNext}
          title="下一页"
        >
          ›
        </button>

        <div className="mx-1 h-4 w-px bg-white/14" />

        <div className="flex items-center gap-1 rounded-md bg-black/20 p-1">
          <button
            className={cn(
              'rounded px-2 py-1 text-[11px] font-semibold transition focus:outline-none focus-visible:outline-none',
              readerMode === 'paged' ? 'bg-[#2f6cf6] text-white' : 'text-[#dce2ec] hover:bg-white/10'
            )}
            onClick={() => onReaderModeChange('paged')}
            onMouseDown={onToolbarButtonMouseDown}
            title="翻页模式"
          >
            翻
          </button>
          <button
            className={cn(
              'rounded px-2 py-1 text-[11px] font-semibold transition focus:outline-none focus-visible:outline-none',
              readerMode === 'scroll' ? 'bg-[#2f6cf6] text-white' : 'text-[#dce2ec] hover:bg-white/10'
            )}
            onClick={() => onReaderModeChange('scroll')}
            onMouseDown={onToolbarButtonMouseDown}
            title="滚动模式"
          >
            滚
          </button>
        </div>

        <div className="flex items-center gap-1 rounded-md bg-black/20 p-1">
          <button
            className={cn(
              'rounded px-2 py-1 text-[11px] font-semibold transition focus:outline-none focus-visible:outline-none',
              widthMode === 'fit' ? 'bg-[#2f6cf6] text-white' : 'text-[#dce2ec] hover:bg-white/10'
            )}
            onClick={() => onWidthModeChange('fit')}
            onMouseDown={onToolbarButtonMouseDown}
            title="适应宽度"
          >
            适
          </button>
          <button
            className={cn(
              'rounded px-2 py-1 text-[11px] font-semibold transition focus:outline-none focus-visible:outline-none',
              widthMode === 'fixed' ? 'bg-[#2f6cf6] text-white' : 'text-[#dce2ec] hover:bg-white/10'
            )}
            onClick={() => onWidthModeChange('fixed')}
            onMouseDown={onToolbarButtonMouseDown}
            title="固定宽度"
          >
            固
          </button>

          <button
            className="inline-flex h-6 w-6 items-center justify-center rounded text-[#e3e5ea] transition hover:bg-white/10 focus:outline-none focus-visible:outline-none disabled:opacity-40"
            onClick={() => onAdjustWidth(-5)}
            onMouseDown={onToolbarButtonMouseDown}
            disabled={!canDecreaseWidth}
            title="缩小宽度"
          >
            <Minus className="h-3 w-3" />
          </button>
          <span className="min-w-[44px] text-center text-[11px] font-semibold text-[#e3e5ea]">{widthLabel}</span>
          <button
            className="inline-flex h-6 w-6 items-center justify-center rounded text-[#e3e5ea] transition hover:bg-white/10 focus:outline-none focus-visible:outline-none disabled:opacity-40"
            onClick={() => onAdjustWidth(5)}
            onMouseDown={onToolbarButtonMouseDown}
            disabled={!canIncreaseWidth}
            title="增大宽度"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
