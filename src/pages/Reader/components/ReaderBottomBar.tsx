import { ArrowLeft, ChevronLeft, ChevronRight, Images, Minus, Plus } from 'lucide-react';
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
  onOpenPageEditor: () => void;
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
  onOpenPageEditor,
  onPrev,
  onNext,
  onReaderModeChange,
  onWidthModeChange,
  onAdjustWidth,
  onToolbarButtonMouseDown
}: ReaderBottomBarProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 z-30 flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-[920px] items-center gap-3 rounded-full border border-white/10 bg-[#0f1115]/75 px-4 py-3 shadow-[0_20px_40px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        {/* Back Button */}
        <button
          className="group inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-white/5 py-1 pl-2.5 pr-3.5 text-[#dce2ec] transition-all duration-200 hover:bg-white/15 hover:text-white focus:outline-none"
          onClick={onBack}
          onMouseDown={onToolbarButtonMouseDown}
          title="返回"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          <span className="text-[12px] font-medium tracking-wide">返回</span>
        </button>

        <div className="mx-1 h-5 w-px shrink-0 bg-white/10" />

        {/* Page Slider */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex shrink-0 min-w-[54px] items-center justify-center rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-medium tracking-wide text-[#e7eaf0] ring-1 ring-white/10">
            {pageProgress}
          </div>
          <input
            type="range"
            min={1}
            max={Math.max(pageCount, 1)}
            value={Math.min(currentPageIndex + 1, Math.max(pageCount, 1))}
            onChange={onSliderChange}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/20 accent-[#3d7cf9] outline-none transition-all hover:bg-white/30"
            aria-label="页面快速跳转"
          />
        </div>

        <div className="mx-1 h-5 w-px shrink-0 bg-white/10" />

        {/* Navigation Buttons */}
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/5 text-[#a3b1c6] transition-all duration-200 hover:bg-white/15 hover:text-white focus:outline-none"
            onClick={onPrev}
            onMouseDown={onToolbarButtonMouseDown}
            title={canGoPrev ? '上一页' : '显示前面的候选漫画'}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/5 text-[#a3b1c6] transition-all duration-200 hover:bg-white/15 hover:text-white focus:outline-none"
            onClick={onNext}
            onMouseDown={onToolbarButtonMouseDown}
            title={canGoNext ? '下一页' : '显示后面的候选漫画'}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mx-1 h-5 w-px shrink-0 bg-white/10" />

        {/* Read Mode Toggles */}
        <div className="flex shrink-0 items-center gap-1 rounded-full bg-black/40 p-1 ring-1 ring-white/5">
          <button
            className={cn(
              'rounded-full px-3.5 py-1 text-[11px] font-medium transition-all duration-200 focus:outline-none',
              readerMode === 'paged' ? 'bg-[#3d7cf9] text-white shadow-md' : 'text-[#8c9bab] hover:text-[#dce2ec]'
            )}
            onClick={() => onReaderModeChange('paged')}
            onMouseDown={onToolbarButtonMouseDown}
            title="翻页模式"
          >
            翻页
          </button>
          <button
            className={cn(
              'rounded-full px-3.5 py-1 text-[11px] font-medium transition-all duration-200 focus:outline-none',
              readerMode === 'scroll' ? 'bg-[#3d7cf9] text-white shadow-md' : 'text-[#8c9bab] hover:text-[#dce2ec]'
            )}
            onClick={() => onReaderModeChange('scroll')}
            onMouseDown={onToolbarButtonMouseDown}
            title="滚动模式"
          >
            滚动
          </button>
        </div>

        {/* Width Mode Toggles */}
        <div className="flex shrink-0 items-center gap-1 rounded-full bg-black/40 p-1 ring-1 ring-white/5">
          <button
            className={cn(
              'rounded-full px-3.5 py-1 text-[11px] font-medium transition-all duration-200 focus:outline-none',
              widthMode === 'fit' ? 'bg-white/20 text-white shadow-md backdrop-blur-md' : 'text-[#8c9bab] hover:text-[#dce2ec]'
            )}
            onClick={() => onWidthModeChange('fit')}
            onMouseDown={onToolbarButtonMouseDown}
            title="适应宽度"
          >
            适应
          </button>
          <button
            className={cn(
              'rounded-full px-3.5 py-1 text-[11px] font-medium transition-all duration-200 focus:outline-none',
              widthMode === 'fixed' ? 'bg-white/20 text-white shadow-md backdrop-blur-md' : 'text-[#8c9bab] hover:text-[#dce2ec]'
            )}
            onClick={() => onWidthModeChange('fixed')}
            onMouseDown={onToolbarButtonMouseDown}
            title="固定宽度"
          >
            固定
          </button>

          <div className="mx-1.5 h-3 w-px bg-white/10" />

          <button
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[#a3b1c6] transition-all hover:bg-white/15 hover:text-white focus:outline-none disabled:opacity-30 disabled:hover:bg-transparent"
            onClick={() => onAdjustWidth(-5)}
            onMouseDown={onToolbarButtonMouseDown}
            disabled={!canDecreaseWidth}
            title="缩小宽度"
          >
            <Minus className="h-3 w-3" />
          </button>
          <span className="min-w-[42px] text-center text-[11px] font-medium text-[#e3e5ea]">{widthLabel}</span>
          <button
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[#a3b1c6] transition-all hover:bg-white/15 hover:text-white focus:outline-none disabled:opacity-30 disabled:hover:bg-transparent"
            onClick={() => onAdjustWidth(5)}
            onMouseDown={onToolbarButtonMouseDown}
            disabled={!canIncreaseWidth}
            title="增大宽度"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>

        <div className="mx-1 h-5 w-px shrink-0 bg-white/10" />

        {/* Organize Button */}
        <button
          className="group inline-flex shrink-0 h-8 items-center gap-1.5 rounded-full bg-white/5 py-1 pl-3 pr-3.5 text-[#dce2ec] transition-all duration-200 hover:bg-[#3d7cf9] hover:text-white hover:shadow-[0_0_12px_rgba(61,124,249,0.4)] focus:outline-none"
          onClick={onOpenPageEditor}
          onMouseDown={onToolbarButtonMouseDown}
          title="编辑漫画页面"
        >
          <Images className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />
          <span className="text-[12px] font-medium tracking-wide">整理</span>
        </button>
      </div>
    </div>
  );
}
