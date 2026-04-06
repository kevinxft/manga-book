import { useEffect, useRef } from 'react';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import type { OrganizerCategory } from '../types';

interface RenameAuthorDirectoryDialogProps {
  open: boolean;
  target: OrganizerCategory | null;
  value: string;
  renaming: boolean;
  onValueChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function RenameAuthorDirectoryDialog({
  open,
  target,
  value,
  renaming,
  onValueChange,
  onClose,
  onSubmit
}: RenameAuthorDirectoryDialogProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open || !target) {
      return;
    }

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
        <p className="text-[15px] font-semibold text-[#1f2f48]">重命名作者目录</p>
        <p className="mt-2 text-[12px] leading-5 text-[#5f7088]">修改作者目录名称，并同步更新该目录下漫画的路径记录。</p>

        <div className="mt-3">
          <Input
            ref={inputRef}
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            placeholder="请输入新的作者名称"
            disabled={renaming}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void onSubmit();
              }
            }}
          />
        </div>

        <p className="mt-2 rounded-md bg-[#eef3fb] px-2.5 py-2 text-[12px] font-semibold text-[#2e4360]">{target.label}</p>

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
            onClick={onSubmit}
            disabled={renaming || value.trim().length === 0}
          >
            {renaming ? '重命名中...' : '确认重命名'}
          </Button>
        </div>
      </div>
    </div>
  );
}
