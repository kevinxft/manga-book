import { useEffect, useState } from 'react';
import { Settings2, X } from 'lucide-react';
import { cn } from '@renderer/lib/utils';
import { SegmentButton, ToggleSwitch } from './components/SettingsPrimitives';
import { useSettingsDraft } from './hooks/useSettingsDraft';
import type { ReaderSettingsPayload } from './types';

interface SettingsPageProps extends ReaderSettingsPayload {
  open: boolean;
  onSave: (next: ReaderSettingsPayload) => void;
  onClose: () => void;
}

export function SettingsPage({
  open,
  readerMode,
  widthMode,
  fixedWidthPercent,
  pageAnimationEnabled,
  boundarySuggestionCount,
  onSave,
  onClose
}: SettingsPageProps) {
  const {
    draftReaderMode,
    draftWidthMode,
    draftFixedWidthPercent,
    draftPageAnimationEnabled,
    draftBoundarySuggestionCount,
    setDraftReaderMode,
    setDraftWidthMode,
    setDraftFixedWidthPercent,
    setDraftPageAnimationEnabled,
    setDraftBoundarySuggestionCount,
    dirty,
    buildPayload
  } = useSettingsDraft({
    open,
    readerMode,
    widthMode,
    fixedWidthPercent,
    pageAnimationEnabled,
    boundarySuggestionCount
  });

  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const timer = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
      const timer = setTimeout(() => setMounted(false), 300); // matches duration-300
      return () => clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [onClose, open]);

  if (!mounted) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-slate-900/10 p-4 backdrop-blur-sm sm:p-8',
        'transition-all duration-300 ease-out',
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      )}
      onClick={onClose}
    >
      <div
        className={cn(
          'w-[520px] max-w-[calc(100vw-32px)] overflow-hidden rounded-[28px] border border-slate-100 bg-white shadow-[0_12px_44px_rgba(0,0,0,0.08)]',
          'transition-all duration-300 ease-out',
          visible ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 shadow-sm ring-1 ring-blue-500/20">
              <Settings2 className="h-4 w-4 text-white" />
            </div>
            <h2 className="text-[15px] font-semibold tracking-wide text-slate-800">阅读与界面设置</h2>
          </div>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-slate-800 ring-1 ring-slate-200/60"
            onClick={onClose}
            title="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="max-h-[72vh] space-y-6 overflow-auto px-6 py-5">
          <section>
            <p className="text-[12px] font-semibold tracking-wide text-slate-700">阅读模式</p>
            <div className="mt-2 rounded-full border border-slate-100 bg-slate-100/60 p-1">
              <div className="flex gap-1">
                <SegmentButton active={draftReaderMode === 'paged'} label="翻页模式" onClick={() => setDraftReaderMode('paged')} />
                <SegmentButton active={draftReaderMode === 'scroll'} label="滚动模式" onClick={() => setDraftReaderMode('scroll')} />
              </div>
            </div>
            <p className="mt-2 text-[12px] text-slate-500">
              {draftReaderMode === 'paged' ? '每次切换一整页，适合常规单页漫画。' : '无缝纵向往下滚动浏览，适合长条式彩色漫画。'}
            </p>
          </section>

          <section>
            <p className="text-[12px] font-semibold tracking-wide text-slate-700">显示宽度</p>
            <div className="mt-2 rounded-full border border-slate-100 bg-slate-100/60 p-1">
              <div className="flex gap-1">
                <SegmentButton active={draftWidthMode === 'fit'} label="适应屏幕" onClick={() => setDraftWidthMode('fit')} />
                <SegmentButton active={draftWidthMode === 'fixed'} label="固定宽度" onClick={() => setDraftWidthMode('fixed')} />
              </div>
            </div>
            <p className="mt-2 text-[12px] text-slate-500">
              {draftWidthMode === 'fit' ? '页面画面将自动缩放以填满当前窗口。' : '不受窗口限制，使用下方的自定义百分比固定画面渲染宽度。'}
            </p>

            <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-slate-700">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[13px] font-semibold">宽度百分比</p>
                <span className="rounded-full bg-slate-200/60 px-3 py-1 text-[11px] font-bold tracking-wide ring-1 ring-slate-200">
                  {draftFixedWidthPercent}%
                </span>
              </div>
              <input
                type="range"
                min={50}
                max={100}
                step={5}
                value={draftFixedWidthPercent}
                onChange={(event) => setDraftFixedWidthPercent(Number(event.target.value))}
                className={cn(
                  'h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-500 outline-none transition-all hover:bg-slate-300',
                  draftWidthMode !== 'fixed' && 'cursor-not-allowed opacity-40'
                )}
                disabled={draftWidthMode !== 'fixed'}
              />
              <div className="mt-2 flex items-center justify-between text-[11px] font-medium text-slate-400">
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
            </div>
          </section>

          <section className="border-t border-slate-100 pt-5">
            <ToggleSwitch
              checked={draftPageAnimationEnabled}
              title="翻页动画"
              description="开启后滚动模式切页会使用平滑动画。"
              onToggle={() => setDraftPageAnimationEnabled((prev) => !prev)}
            />
          </section>

          <section className="border-t border-slate-100 pt-5 pb-2">
            <p className="text-[12px] font-semibold tracking-wide text-slate-700">边界候选漫画数量</p>
            <div className="mt-2 rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-slate-700">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[13px] font-semibold">翻页到底部时的候选数</p>
                <span className="rounded-full bg-slate-200/60 px-3 py-1 text-[11px] font-bold tracking-wide ring-1 ring-slate-200">
                  {draftBoundarySuggestionCount} 本
                </span>
              </div>
              <input
                type="range"
                min={3}
                max={12}
                step={1}
                value={draftBoundarySuggestionCount}
                onChange={(event) => setDraftBoundarySuggestionCount(Number(event.target.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-500 outline-none transition-all hover:bg-slate-300"
              />
              <div className="mt-2 flex items-center justify-between text-[11px] font-medium text-slate-400">
                <span>3 本</span>
                <span>7 本</span>
                <span>12 本</span>
              </div>
            </div>
          </section>
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4">
          <button
            className="group inline-flex h-9 items-center justify-center rounded-full bg-white px-5 text-[13px] font-medium text-slate-600 ring-1 ring-slate-200 transition-all duration-200 hover:bg-slate-50 hover:text-slate-900 focus:outline-none"
            onClick={onClose}
          >
            取消
          </button>
          <button
            className={cn(
              'group inline-flex h-9 items-center justify-center rounded-full px-5 text-[13px] font-medium text-white transition-all duration-300 focus:outline-none',
              dirty ? 'bg-blue-600 hover:bg-blue-500 hover:scale-105 active:scale-95 shadow-md shadow-blue-500/20' : 'cursor-not-allowed bg-slate-200 text-slate-400'
            )}
            onClick={() => {
              if (!dirty) return;
              onSave(buildPayload());
              onClose();
            }}
            disabled={!dirty}
          >
            保存所有更改
          </button>
        </footer>
      </div>
    </div>
  );
}
