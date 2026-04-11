import type { MangaBookWithCover } from '@shared/types';
import { Button } from '@renderer/components/ui/button';

interface DeleteMangaDialogProps {
  open: boolean;
  target: MangaBookWithCover | null;
  deleting: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteMangaDialog({ open, target, deleting, error, onClose, onConfirm }: DeleteMangaDialogProps) {
  if (!open || !target) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-[420px] rounded-xl border border-[#d4dceb] bg-[#f9fbff] p-4 shadow-[0_20px_50px_rgba(20,34,58,0.35)]">
        <p className="text-[15px] font-semibold text-[#1f2f48]">确认删除漫画？</p>
        <p className="mt-2 text-[12px] leading-5 text-[#5f7088]">将把整个漫画目录移入系统回收站，可在系统回收站中恢复。</p>
        <p className="mt-2 rounded-md bg-[#eef3fb] px-2.5 py-2 text-[12px] font-semibold text-[#2e4360]">{target.title}</p>
        {error ? (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-2.5 py-2 text-[12px] font-semibold text-red-700">
            {error}
          </p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            className="h-8 rounded-lg border border-[#d2dbe8] bg-white px-3 text-[12px] font-semibold text-[#4d617f] hover:bg-[#f1f5fb]"
            onClick={onClose}
            disabled={deleting}
          >
            取消
          </Button>
          <Button
            type="button"
            className="h-8 rounded-lg bg-[#c73a3a] px-3 text-[12px] font-semibold text-white hover:bg-[#a83131]"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? '移动中...' : '移入回收站'}
          </Button>
        </div>
      </div>
    </div>
  );
}
