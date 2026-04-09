import { useEffect, useRef, useState } from 'react';
import type { MangaBookWithCover } from '@shared/types';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';

interface RenameMangaDialogProps {
  open: boolean;
  target: MangaBookWithCover | null;
  renaming: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
}

export function RenameMangaDialog({
  open,
  target,
  renaming,
  onClose,
  onSubmit
}: RenameMangaDialogProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [value, setValue] = useState('');

  useEffect(() => {
    if (!open || !target) {
      return;
    }

    setValue(target.title);

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [open, target]);

  if (!open || !target) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-[460px] rounded-xl border border-[#d4dceb] bg-[#f9fbff] p-4 shadow-[0_20px_50px_rgba(20,34,58,0.35)]">
        <p className="text-[15px] font-semibold text-[#1f2f48]">重命名漫画</p>
        <p className="mt-2 text-[12px] leading-5 text-[#5f7088]">修改漫画标题，同时同步更新对应文件夹名称。</p>

        <div className="mt-3">
          <Input
            ref={inputRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="请输入新的漫画名称"
            disabled={renaming}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onSubmit(value);
              }
            }}
          />
        </div>

        <p className="mt-2 rounded-md bg-[#eef3fb] px-2.5 py-2 text-[12px] font-semibold text-[#2e4360]">{target.title}</p>

        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            className="h-8 rounded-lg border border-[#d2dbe8] bg-white px-3 text-[12px] font-semibold text-[#4d617f] hover:bg-[#f1f5fb]"
            onClick={onClose}
            disabled={renaming}
          >
            取消
          </Button>
          <Button
            type="button"
            className="h-8 rounded-lg bg-[#2f6cf6] px-3 text-[12px] font-semibold text-white hover:bg-[#2458cc]"
            onClick={() => onSubmit(value)}
            disabled={renaming || value.trim().length === 0}
          >
            {renaming ? '重命名中...' : '确认重命名'}
          </Button>
        </div>
      </div>
    </div>
  );
}
