import { useEffect, useState } from 'react';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';

interface CreateLibraryRootDialogProps {
  open: boolean;
  parentPath: string | null;
  creating: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (directoryName: string) => void;
}

export function CreateLibraryRootDialog({
  open,
  parentPath,
  creating,
  error,
  onClose,
  onSubmit
}: CreateLibraryRootDialogProps) {
  const [directoryName, setDirectoryName] = useState('我的漫画');

  useEffect(() => {
    if (!open) {
      return;
    }
    setDirectoryName('我的漫画');
  }, [open, parentPath]);

  if (!open || !parentPath) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/35 p-4">
      <div className="w-full max-w-[460px] rounded-xl border border-[#d3dced] bg-[#f9fbff] p-4 shadow-[0_20px_50px_rgba(20,34,58,0.35)]">
        <p className="text-[15px] font-semibold text-[#1f2f48]">创建漫画库</p>
        <p className="mt-1 text-[12px] leading-6 text-[#647792]">
          已选择上级目录：
          <br />
          <span className="break-all font-semibold text-[#42536f]">{parentPath}</span>
        </p>
        <p className="mt-2 text-[12px] leading-6 text-[#647792]">
          实际创建目录时会自动补上
          <code className="mx-1 rounded bg-white px-1.5 py-0.5 text-[11px] font-semibold text-[#42536f]">.mangalibrary</code>
          后缀。
        </p>

        <form
          className="mt-3 space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(directoryName);
          }}
        >
          <Input
            value={directoryName}
            onChange={(event) => setDirectoryName(event.target.value)}
            className="h-9 rounded-lg border-[#d5deea] bg-white text-[13px]"
            placeholder="输入要创建的漫画库目录名"
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
              {creating ? '创建中...' : '创建漫画库'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
