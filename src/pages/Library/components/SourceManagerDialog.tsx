import { FolderOpen, RefreshCw, Trash2, X } from 'lucide-react';
import type { LibraryFolder } from '@shared/types';

interface SourceManagerDialogProps {
  open: boolean;
  sources: LibraryFolder[];
  sourceMangaCountByPath: Record<string, number>;
  hasIpcBridge: boolean;
  scanRunning: boolean;
  onClose: () => void;
  onOpenSourceFolder: (sourcePath: string) => void;
  onSyncSource: (sourcePath: string) => void;
  onRemoveSource: (sourceId: string) => void;
}

export function SourceManagerDialog({
  open,
  sources,
  sourceMangaCountByPath,
  hasIpcBridge,
  scanRunning,
  onClose,
  onOpenSourceFolder,
  onSyncSource,
  onRemoveSource
}: SourceManagerDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[115] flex items-center justify-center bg-black/35 p-4">
      <div className="flex h-[60vh] w-full max-w-[480px] flex-col overflow-hidden rounded-xl border border-[#d3dceb] bg-[#f9fbff] shadow-[0_22px_54px_rgba(20,34,58,0.32)]">
        <div className="flex items-center justify-between border-b border-[#dce3ef] px-4 py-3">
          <p className="text-[15px] font-semibold text-[#1f2f48]">已导入目录 ({sources.length})</p>
          <button
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#6e7f99] transition hover:bg-[#e6edf8] hover:text-[#425672]"
            onClick={onClose}
            title="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {sources.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#d4dbe7] bg-[#f8fafd] px-3 py-3 text-sm text-[#8c97aa]">
              暂无已导入目录
            </div>
          ) : (
            <div className="space-y-2">
              {sources.map((source) => (
                <div key={source.id} className="rounded-lg border border-[#dbe2ee] bg-[#f9fbff] px-3 py-2" title={source.path}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[14px] font-semibold text-[#2b3950]">{source.displayName}</p>
                        {source.isTarget ? (
                          <div className="shrink-0 inline-flex items-center rounded bg-[#dfe9fb] px-1.5 py-0.5 text-[10px] font-bold text-[#2f6cf6]">
                            作者目录
                          </div>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-[#8492a6]">{source.path}</p>
                      <p className="mt-0.5 text-[11px] font-bold text-[#5684e4]">
                        {sourceMangaCountByPath[source.path] ?? 0} 本漫画
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        className="rounded-md p-1 text-[#7a879a] transition hover:bg-[#e8eef9] hover:text-[#2f6cf6] disabled:opacity-50"
                        disabled={!hasIpcBridge}
                        onClick={() => onOpenSourceFolder(source.path)}
                        title="打开这个目录"
                      >
                        <FolderOpen className="h-4 w-4" />
                      </button>
                      <button
                        className="rounded-md p-1 text-[#7a879a] transition hover:bg-[#e8eef9] hover:text-[#2f6cf6] disabled:opacity-50"
                        disabled={!hasIpcBridge || scanRunning}
                        onClick={() => onSyncSource(source.path)}
                        title="同步这个目录"
                      >
                        <RefreshCw className={`h-4 w-4 ${scanRunning ? 'animate-spin' : ''}`} />
                      </button>
                      <button
                        className="rounded-md p-1 text-[#7a879a] transition hover:bg-[#e8eef9] hover:text-[#d23b3b] disabled:opacity-50"
                        disabled={!hasIpcBridge || scanRunning}
                        onClick={() => {
                          if (!window.confirm(`确认移除目录？\\n${source.path}`)) return;
                          onRemoveSource(source.id);
                        }}
                        title="移除这个目录"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
