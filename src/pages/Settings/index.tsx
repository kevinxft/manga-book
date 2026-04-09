import { useEffect } from 'react';
import { Settings2, X } from 'lucide-react';
import { cn } from '@renderer/lib/utils';
import { OptionCard, SegmentButton, ToggleSwitch } from './components/SettingsPrimitives';
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

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 sm:p-8 transition-all" onClick={onClose}>
      <div
        className="w-[700px] max-w-[calc(100vw-32px)] overflow-hidden rounded-3xl border border-white/60 bg-slate-50/95 shadow-[0_24px_72px_rgba(15,23,42,0.2)] backdrop-blur-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-200/60 bg-white/50 px-6 py-5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500 shadow-sm ring-1 ring-blue-600/20">
              <Settings2 className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-[16px] font-bold tracking-wide text-slate-800">阅读与界面设置</h2>
          </div>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200/50 text-slate-500 transition-all hover:bg-slate-200 hover:text-slate-900"
            onClick={onClose}
            title="关闭设置"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="max-h-[72vh] space-y-3.5 overflow-auto px-6 py-4">
          <section>
            <p className="text-[12px] font-bold tracking-wide text-[#1f2b3d]">阅读模式</p>
            <div className="mt-2 rounded-xl bg-[#e8edf4] p-1.5">
              <div className="flex gap-1.5">
                <SegmentButton active={draftReaderMode === 'paged'} label="翻页模式" onClick={() => setDraftReaderMode('paged')} />
                <SegmentButton active={draftReaderMode === 'scroll'} label="滚动模式" onClick={() => setDraftReaderMode('scroll')} />
              </div>
            </div>
            <p className="mt-2 text-[12px] text-[#7687a1]">翻页模式每次切换一页，滚动模式为连续纵向浏览。</p>
          </section>

          <section>
            <p className="text-[12px] font-bold tracking-wide text-[#1f2b3d]">显示宽度</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <OptionCard
                active={draftWidthMode === 'fit'}
                title="适应屏幕"
                desc="自动贴合窗口宽度"
                onClick={() => setDraftWidthMode('fit')}
              />
              <OptionCard
                active={draftWidthMode === 'fixed'}
                title="固定宽度"
                desc="使用自定义百分比"
                onClick={() => setDraftWidthMode('fixed')}
              />
            </div>

            <div className="mt-3 rounded-xl border border-[#d8e0ec] bg-[#eef2f8] px-4 py-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[13px] font-semibold text-[#3c4d66]">宽度百分比</p>
                <span className="rounded-md bg-[#dce8fb] px-2.5 py-1 text-[13px] font-bold text-[#2f6cf6]">
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
                  'h-1.5 w-full cursor-pointer accent-[#2f6cf6]',
                  draftWidthMode !== 'fixed' && 'cursor-not-allowed opacity-45'
                )}
                disabled={draftWidthMode !== 'fixed'}
              />
              <div className="mt-1.5 flex items-center justify-between text-[12px] font-semibold text-[#8294af]">
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
            </div>
          </section>

          <section className="border-t border-[#dbe2ee] pt-3">
            <ToggleSwitch
              checked={draftPageAnimationEnabled}
              title="翻页动画"
              description="开启后滚动模式切页会使用平滑动画。"
              onToggle={() => setDraftPageAnimationEnabled((prev) => !prev)}
            />
          </section>

          <section className="border-t border-[#dbe2ee] pt-3">
            <p className="text-[12px] font-bold tracking-wide text-[#1f2b3d]">边界候选漫画数量</p>
            <div className="mt-2 rounded-xl border border-[#d8e0ec] bg-[#eef2f8] px-4 py-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[13px] font-semibold text-[#3c4d66]">第一页/最后一页继续翻页时显示的候选数</p>
                <span className="rounded-md bg-[#dce8fb] px-2.5 py-1 text-[13px] font-bold text-[#2f6cf6]">
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
                className="h-1.5 w-full cursor-pointer accent-[#2f6cf6]"
              />
              <div className="mt-1.5 flex items-center justify-between text-[12px] font-semibold text-[#8294af]">
                <span>3 本</span>
                <span>7 本</span>
                <span>12 本</span>
              </div>
            </div>
          </section>
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-slate-200/60 bg-white/50 px-6 py-4 backdrop-blur-md">
          <button
            className="h-10 rounded-xl border border-slate-200 bg-white px-6 text-[13px] font-bold text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-900 shadow-sm"
            onClick={onClose}
          >
            取消
          </button>
          <button
            className={cn(
              'h-10 rounded-xl px-6 text-[13px] font-bold text-white shadow-md transition-all duration-300',
              dirty ? 'bg-blue-600 hover:bg-blue-500 hover:shadow-blue-500/25' : 'cursor-not-allowed bg-slate-300 shadow-none'
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
