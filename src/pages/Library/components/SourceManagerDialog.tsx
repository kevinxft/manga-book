import { useEffect, useState } from 'react';
import { FolderOpen, RefreshCw, Trash2, X } from 'lucide-react';
import type { LibraryFolder } from '@shared/types';
import { cn } from '@renderer/lib/utils';

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
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const timer = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
      const timer = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  if (!mounted) {
    return null;
  }

  return (
    <div className={cn(
      "fixed inset-0 z-[115] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm transition-all duration-300 ease-out",
      visible ? "opacity-100" : "opacity-0 pointer-events-none"
    )}>
      <div className={cn(
        "flex h-[60vh] w-full max-w-[480px] flex-col overflow-hidden rounded-[28px] border border-white/60 bg-white/90 shadow-[0_24px_60px_rgba(15,23,42,0.15)] ring-1 ring-slate-200/50 backdrop-blur-2xl transition-all duration-300 ease-out",
        visible ? "scale-100 opacity-100 translate-y-0" : "scale-95 opacity-0 translate-y-4"
      )}>
        <div className="flex items-center justify-between border-b border-slate-200/50 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 shadow-sm ring-1 ring-blue-500/10">
              <FolderOpen className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-[15px] font-bold tracking-wide text-slate-800">已导入目录 ({sources.length})</p>
          </div>
          <button
            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-600 focus:bg-slate-100 focus:outline-none"
            onClick={onClose}
            title="关闭窗口"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4 library-sidebar-scroll">
          {sources.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200/60 bg-slate-50/50 px-3 py-6 text-center text-[12px] font-bold text-slate-400 shadow-sm">
              暂无已导入目录
            </div>
          ) : (
            <div className="space-y-2.5">
              {sources.map((source) => (
                <div key={source.id} className="group relative rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm transition-all hover:border-blue-200 hover:shadow" title={source.path}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[14px] font-bold tracking-wide text-slate-700 transition-colors group-hover:text-blue-700">{source.displayName}</p>
                        {source.isTarget ? (
                          <div className="shrink-0 inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold tracking-wider text-blue-600 ring-1 ring-blue-200">
                            归档目录
                          </div>
                        ) : null}
                      </div>
                      <p className="mt-1 truncate text-[11px] font-medium text-slate-400 transition-colors group-hover:text-slate-500">{source.path}</p>
                      <p className="mt-1.5 text-[11px] font-bold text-blue-500/80">
                        共 {sourceMangaCountByPath[source.path] ?? 0} 本漫画
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 opacity-80 transition-opacity group-hover:opacity-100">
                      <div className="flex items-center gap-1.5">
                        <button
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600 disabled:pointer-events-none disabled:opacity-50"
                          disabled={!hasIpcBridge}
                          onClick={() => onOpenSourceFolder(source.path)}
                          title="在文件管理器中打开"
                        >
                          <FolderOpen className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600 disabled:pointer-events-none disabled:opacity-50"
                          disabled={!hasIpcBridge || scanRunning}
                          onClick={() => onSyncSource(source.path)}
                          title="立即同步该目录资源"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${scanRunning ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition hover:bg-red-50 hover:text-red-500 disabled:pointer-events-none disabled:opacity-50"
                          disabled={!hasIpcBridge || scanRunning}
                          onClick={() => {
                            if (!window.confirm(`确认移除此目录吗？\n\n移除后，你的漫画库中将不再显示该目录下的漫画资源。\n\n${source.path}`)) return;
                            onRemoveSource(source.id);
                          }}
                          title="从软件内移除此目录"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
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
