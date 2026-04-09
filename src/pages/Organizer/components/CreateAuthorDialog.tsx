import { useEffect, useState } from 'react';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';

interface CreateAuthorDialogProps {
  open: boolean;
  creating: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (value: string) => void;
}

export function CreateAuthorDialog({
  open,
  creating,
  error,
  onClose,
  onSubmit
}: CreateAuthorDialogProps) {
  const [authorName, setAuthorName] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }
    setAuthorName('');
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[125] flex items-center justify-center bg-black/35 p-4">
      <div className="w-full max-w-[420px] rounded-xl border border-[#d3dced] bg-[#f9fbff] p-4 shadow-[0_20px_50px_rgba(20,34,58,0.35)]">
        <p className="text-[15px] font-semibold text-[#1f2f48]">新建作者</p>
        <p className="mt-1 text-[12px] text-[#647792]">创建后会出现在右侧整理目录，可直接用于快速移动。</p>

        <form
          className="mt-3 space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(authorName);
          }}
        >
          <Input
            value={authorName}
            onChange={(event) => setAuthorName(event.target.value)}
            className="h-9 rounded-lg border-[#d5deea] bg-white text-[13px]"
            placeholder="输入作者名"
            autoFocus
          />

          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[12px] text-red-700">{error}</p>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              className="h-8 rounded-lg border border-[#d2dbe8] bg-white px-3 text-[12px] font-semibold text-[#4d617f] hover:bg-[#f1f5fb]"
              onClick={onClose}
              disabled={creating}
            >
              取消
            </Button>
            <Button
              type="submit"
              className="h-8 rounded-lg bg-[#2f7fe6] px-3 text-[12px] font-semibold text-white hover:bg-[#236ecc]"
              disabled={creating}
            >
              {creating ? '创建中...' : '创建作者'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
