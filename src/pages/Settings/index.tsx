import { useEffect, useMemo, useState } from 'react';
import { Settings2, X } from 'lucide-react';
import type { ReaderMode, ReaderWidthMode } from '@renderer/pages/Reader';
import { cn } from '@renderer/lib/utils';

interface SettingsPageProps {
  open: boolean;
  readerMode: ReaderMode;
  widthMode: ReaderWidthMode;
  fixedWidthPercent: number;
  pageAnimationEnabled: boolean;
  onSave: (next: {
    readerMode: ReaderMode;
    widthMode: ReaderWidthMode;
    fixedWidthPercent: number;
    pageAnimationEnabled: boolean;
  }) => void;
  onClose: () => void;
}

function SegmentButton({
  active,
  label,
  onClick
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'h-9 flex-1 rounded-lg text-[13px] font-semibold transition',
        active ? 'bg-white text-[#2f6cf6] shadow-[0_2px_6px_rgba(47,108,246,0.12)]' : 'text-[#5d6d85] hover:bg-white/60'
      )}
    >
      {label}
    </button>
  );
}

function OptionCard({
  active,
  title,
  desc,
  onClick
}: {
  active: boolean;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-xl border p-3 text-left transition',
        active ? 'border-[#2f6cf6] bg-[#eef5ff]' : 'border-[#dbe2ee] bg-white hover:bg-[#f7f9fc]'
      )}
    >
      <p className={cn('text-[13px] font-semibold', active ? 'text-[#2f6cf6]' : 'text-[#1f2b3d]')}>{title}</p>
      <p className="mt-0.5 text-[12px] text-[#667892]">{desc}</p>
    </button>
  );
}

export function SettingsPage({
  open,
  readerMode,
  widthMode,
  fixedWidthPercent,
  pageAnimationEnabled,
  onSave,
  onClose
}: SettingsPageProps) {
  const [draftReaderMode, setDraftReaderMode] = useState<ReaderMode>(readerMode);
  const [draftWidthMode, setDraftWidthMode] = useState<ReaderWidthMode>(widthMode);
  const [draftFixedWidthPercent, setDraftFixedWidthPercent] = useState(fixedWidthPercent);
  const [draftPageAnimationEnabled, setDraftPageAnimationEnabled] = useState(pageAnimationEnabled);

  useEffect(() => {
    if (!open) return;
    setDraftReaderMode(readerMode);
    setDraftWidthMode(widthMode);
    setDraftFixedWidthPercent(fixedWidthPercent);
    setDraftPageAnimationEnabled(pageAnimationEnabled);
  }, [fixedWidthPercent, open, pageAnimationEnabled, readerMode, widthMode]);

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

  const dirty = useMemo(() => {
    return (
      draftReaderMode !== readerMode ||
      draftWidthMode !== widthMode ||
      draftFixedWidthPercent !== fixedWidthPercent ||
      draftPageAnimationEnabled !== pageAnimationEnabled
    );
  }, [
    draftFixedWidthPercent,
    draftPageAnimationEnabled,
    draftReaderMode,
    draftWidthMode,
    fixedWidthPercent,
    pageAnimationEnabled,
    readerMode,
    widthMode
  ]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0e131d]/58 px-4 py-8" onClick={onClose}>
      <div
        className="w-[700px] max-w-[calc(100vw-32px)] overflow-hidden rounded-2xl border border-[#d7dde8] bg-[#f4f6fa] shadow-[0_24px_72px_rgba(39,53,73,0.35)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-[#dde3ee] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#deebff]">
              <Settings2 className="h-4 w-4 text-[#2f6cf6]" />
            </div>
            <h2 className="text-[15px] font-bold text-[#111b2d]">阅读设置</h2>
          </div>
          <button
            className="rounded-md p-1.5 text-[#7a869b] transition hover:bg-[#e8edf5] hover:text-[#4d5d75]"
            onClick={onClose}
            title="关闭"
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
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-bold text-[#1f2b3d]">翻页动画</p>
                <p className="mt-0.5 text-[12px] text-[#6f819b]">开启后滚动模式切页会使用平滑动画。</p>
              </div>
              <button
                className={cn(
                  'relative h-7 w-[52px] rounded-full border border-[#bcc9dd] transition',
                  draftPageAnimationEnabled ? 'bg-[#2f6cf6] border-[#2f6cf6]' : 'bg-[#c8d2e0]'
                )}
                onClick={() => setDraftPageAnimationEnabled((prev) => !prev)}
                title="切换翻页动画"
              >
                <span
                  className={cn(
                    'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition',
                    draftPageAnimationEnabled ? 'left-[26px]' : 'left-[2px]'
                  )}
                />
              </button>
            </div>
          </section>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-[#dde3ee] bg-[#eef1f6] px-6 py-3.5">
          <button
            className="h-9 rounded-lg border border-[#d4dce8] bg-white px-5 text-[13px] font-semibold text-[#465974] transition hover:bg-[#f5f7fb]"
            onClick={onClose}
          >
            取消
          </button>
          <button
            className={cn(
              'h-9 rounded-lg px-5 text-[13px] font-semibold text-white shadow-[0_8px_18px_rgba(47,108,246,0.26)] transition',
              dirty ? 'bg-[#2f6cf6] hover:bg-[#255de0]' : 'bg-[#8fb3f8] cursor-not-allowed'
            )}
            onClick={() => {
              if (!dirty) return;
              onSave({
                readerMode: draftReaderMode,
                widthMode: draftWidthMode,
                fixedWidthPercent: draftFixedWidthPercent,
                pageAnimationEnabled: draftPageAnimationEnabled
              });
              onClose();
            }}
            disabled={!dirty}
          >
            保存设置
          </button>
        </footer>
      </div>
    </div>
  );
}
