import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';

interface AddTagPopoverProps {
  open: boolean;
  anchor: { x: number; y: number } | null;
  mangaTitle: string | null;
  draftTags: string[];
  inputTagName: string;
  availableTags: string[];
  saving: boolean;
  error: string | null;
  onInputTagNameChange: (value: string) => void;
  onAppendInputTag: () => void;
  onAppendTag: (value: string) => void;
  onRemoveTag: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

const POPOVER_OFFSET = 10;
const VIEWPORT_PADDING = 8;

export function AddTagPopover({
  open,
  anchor,
  mangaTitle,
  draftTags,
  inputTagName,
  availableTags,
  saving,
  error,
  onInputTagNameChange,
  onAppendInputTag,
  onAppendTag,
  onRemoveTag,
  onClose,
  onSubmit
}: AddTagPopoverProps) {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    if (!open || !anchor) {
      setReady(false);
      return;
    }

    const updatePosition = () => {
      if (!popoverRef.current) {
        return;
      }

      const rect = popoverRef.current.getBoundingClientRect();
      const desiredLeft = anchor.x + POPOVER_OFFSET;
      const desiredTop = anchor.y + POPOVER_OFFSET;
      const maxLeft = Math.max(VIEWPORT_PADDING, window.innerWidth - rect.width - VIEWPORT_PADDING);
      const maxTop = Math.max(VIEWPORT_PADDING, window.innerHeight - rect.height - VIEWPORT_PADDING);

      setPosition({
        left: Math.min(Math.max(desiredLeft, VIEWPORT_PADDING), maxLeft),
        top: Math.min(Math.max(desiredTop, VIEWPORT_PADDING), maxTop)
      });
      setReady((prev) => prev || true);
    };

    const frame = window.requestAnimationFrame(updatePosition);
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [open, anchor, availableTags.length, draftTags.length, error]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popoverRef.current && !popoverRef.current.contains(target)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const quickTagCandidates = availableTags.filter((name) => !draftTags.some((tag) => tag.toLocaleLowerCase() === name.toLocaleLowerCase()));

  return (
    <div
      ref={popoverRef}
      className="fixed z-[110] w-[340px] rounded-xl border border-[#d6deea] bg-white p-2 shadow-[0_18px_40px_rgba(30,50,83,0.26)]"
      style={{
        left: position.left,
        top: position.top,
        maxHeight: `calc(100vh - ${VIEWPORT_PADDING * 2}px)`,
        visibility: ready ? 'visible' : 'hidden'
      }}
    >
      <p className="px-2 text-[12px] font-bold text-[#1f2f48]">编辑标签</p>
      <p className="mt-1 truncate px-2 text-[11px] font-semibold text-[#6a7b95]" title={mangaTitle ?? '-'}>
        {mangaTitle ?? '-'}
      </p>

      <div className="mt-2 min-h-[34px] rounded-md border border-[#e2e8f3] bg-[#f8fafe] p-1.5">
        {draftTags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {draftTags.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-1 rounded-md bg-[#e8eef8] px-2 py-1 text-[11px] font-semibold text-[#355173]"
                title={name}
              >
                <span className="max-w-[160px] truncate">{name}</span>
                <button
                  className="inline-flex h-3.5 w-3.5 items-center justify-center rounded text-[#607593] transition hover:bg-[#d6e0ef] hover:text-[#29425f]"
                  onClick={() => onRemoveTag(name)}
                  title="删除标签"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="px-1 text-[11px] text-[#8796ac]">当前没有标签</p>
        )}
      </div>

      <form
        className="mt-2 space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="grid grid-cols-[1fr_auto] gap-1.5">
          <Input
            value={inputTagName}
            onChange={(event) => onInputTagNameChange(event.target.value)}
            className="h-8 rounded-md border-[#d7deeb] bg-[#f3f6fb] text-[12px]"
            placeholder="输入标签名称"
            autoFocus
          />
          <Button
            type="button"
            className="h-8 rounded-md border border-[#d2dbe8] bg-white px-2.5 text-[11px] font-semibold text-[#4d617f] hover:bg-[#f1f5fb]"
            onClick={onAppendInputTag}
            disabled={saving}
          >
            增加
          </Button>
        </div>

        {quickTagCandidates.length > 0 ? (
          <div className="max-h-[124px] overflow-auto rounded-md border border-[#e2e8f3] bg-[#f8fafe] p-1">
            <div className="flex flex-wrap gap-1">
              {quickTagCandidates.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="rounded-md bg-[#e8eef8] px-2 py-1 text-[11px] font-semibold text-[#355173] transition hover:bg-[#dbe6f6]"
                  onClick={() => onAppendTag(name)}
                  title={name}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {error ? <p className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700">{error}</p> : null}

        <div className="flex justify-end gap-1 pt-1">
          <Button
            type="button"
            className="h-7 rounded-md border border-[#d2dbe8] bg-white px-2.5 text-[11px] font-semibold text-[#4d617f] hover:bg-[#f1f5fb]"
            onClick={onClose}
            disabled={saving}
          >
            取消
          </Button>
          <Button
            type="submit"
            className="h-7 rounded-md bg-[#2f7fe6] px-2.5 text-[11px] font-semibold text-white hover:bg-[#236ecc]"
            disabled={saving}
          >
            {saving ? '保存中...' : '保存'}
          </Button>
        </div>
      </form>
    </div>
  );
}
