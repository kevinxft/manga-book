import { useEffect, useState } from 'react';
import { FolderOpen, Import, RefreshCw, Replace, RotateCcw, X } from 'lucide-react';
import type { LibraryRoot } from '@shared/types';
import { cn } from '@renderer/lib/utils';
import type { UnsortedImportSummary } from '../utils';

interface SourceManagerDialogProps {
  open: boolean;
  libraryRoot: LibraryRoot | null;
  sourceMangaCountByPath: Record<string, number>;
  unsortedImports: UnsortedImportSummary[];
  hasIpcBridge: boolean;
  scanRunning: boolean;
  onClose: () => void;
  onPickAndSetLibraryRoot: () => Promise<void> | void;
  onOpenLibraryRoot: () => void;
  onPickAndImportDirectories: () => void;
  onSyncLibrary: () => void;
  onClearLibraryRoot: () => void;
}

export function SourceManagerDialog({
  open,
  libraryRoot,
  sourceMangaCountByPath,
  unsortedImports,
  hasIpcBridge,
  scanRunning,
  onClose,
  onPickAndSetLibraryRoot,
  onOpenLibraryRoot,
  onPickAndImportDirectories,
  onSyncLibrary,
  onClearLibraryRoot
}: SourceManagerDialogProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const isDev = import.meta.env.DEV;

  useEffect(() => {
    if (open) {
      setMounted(true);
      const timer = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(timer);
    }

    setVisible(false);
    const timer = setTimeout(() => setMounted(false), 300);
    return () => clearTimeout(timer);
  }, [open]);

  if (!mounted) {
    return null;
  }

  const mangaCount = libraryRoot ? sourceMangaCountByPath[libraryRoot.path] ?? 0 : 0;

  return (
    <div
      className={cn(
        'fixed inset-0 z-[115] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm transition-all duration-300 ease-out',
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      )}
    >
      <div
        className={cn(
          'flex h-auto max-h-[60vh] w-full max-w-[520px] flex-col overflow-hidden rounded-[28px] border border-white/60 bg-white/95 shadow-[0_24px_60px_rgba(15,23,42,0.15)] ring-1 ring-slate-200/50 backdrop-blur-2xl transition-all duration-300 ease-out',
          visible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-4 scale-95 opacity-0'
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-200/50 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 shadow-sm ring-1 ring-blue-500/10">
              <FolderOpen className="h-4 w-4 text-blue-600" />
            </div>
            <div className="flex items-center gap-2">
              <p className="text-[15px] font-bold tracking-wide text-slate-800">漫画库</p>
              {isDev ? (
                <button
                  className="inline-flex h-6 items-center justify-center gap-1 rounded-full border border-red-200/80 bg-red-50 px-2 text-[9px] font-bold text-red-600 transition hover:bg-red-100 disabled:pointer-events-none disabled:opacity-50"
                  onClick={onClearLibraryRoot}
                  disabled={!hasIpcBridge || scanRunning}
                  title="只清掉当前漫画库配置，不会删除磁盘上的漫画目录"
                >
                  <RotateCcw className="h-2.5 w-2.5" />
                  重置
                </button>
              ) : null}
            </div>
          </div>
          <button
            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-600 focus:bg-slate-100 focus:outline-none"
            onClick={onClose}
            title="关闭窗口"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="library-sidebar-scroll min-h-0 flex-1 space-y-4 overflow-auto p-4">
          {!libraryRoot ? (
            <div className="rounded-2xl border border-dashed border-slate-200/60 bg-slate-50/50 px-4 py-6 text-center shadow-sm">
              <p className="text-[12px] font-bold text-slate-400">还没有设置漫画库</p>
              <button
                className="mt-4 inline-flex h-9 items-center gap-2 rounded-full bg-blue-600 px-4 text-[12px] font-bold text-white shadow-sm shadow-blue-500/20 transition-all hover:bg-blue-500 disabled:pointer-events-none disabled:opacity-50"
                onClick={() => void onPickAndSetLibraryRoot()}
                disabled={!hasIpcBridge}
              >
                <FolderOpen className="h-3.5 w-3.5" />
                选择位置并创建漫画库
              </button>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[14px] font-bold tracking-wide text-slate-700">{libraryRoot.displayName}</p>
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold tracking-wider text-blue-600 ring-1 ring-blue-200">
                        当前漫画库
                      </span>
                    </div>
                    <p className="mt-1 truncate text-[11px] font-medium text-slate-400">{libraryRoot.path}</p>
                    <p className="mt-1.5 text-[11px] font-bold text-blue-500/80">共 {mangaCount} 本漫画</p>
                  </div>
                  <button
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600 disabled:pointer-events-none disabled:opacity-50"
                    disabled={!hasIpcBridge}
                    onClick={onOpenLibraryRoot}
                    title="在文件管理器中打开"
                  >
                    <FolderOpen className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 text-[11px] font-bold text-white shadow-sm shadow-blue-500/20 transition hover:bg-blue-500 disabled:pointer-events-none disabled:opacity-50"
                  onClick={onPickAndImportDirectories}
                  disabled={!hasIpcBridge || scanRunning}
                >
                  <Import className="h-3.5 w-3.5" />
                  导入漫画
                </button>
                <button
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200/70 bg-white px-3 text-[11px] font-bold text-slate-700 transition hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50"
                  onClick={onSyncLibrary}
                  disabled={!hasIpcBridge || scanRunning}
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', scanRunning && 'animate-spin')} />
                  重新扫描
                </button>
                <button
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-amber-200/90 bg-amber-50 px-3 text-[11px] font-bold text-amber-700 transition hover:bg-amber-100 disabled:pointer-events-none disabled:opacity-50"
                  onClick={() => void onPickAndSetLibraryRoot()}
                  disabled={!hasIpcBridge || scanRunning}
                >
                  <Replace className="h-3.5 w-3.5" />
                  更换漫画库位置
                </button>
              </div>
              {isDev ? <p className="text-[11px] leading-5 text-slate-400">重置只会清掉当前漫画库配置，不会删除磁盘上的漫画目录。</p> : null}

              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-bold tracking-wide text-slate-700">已导入到 Unsorted</p>
                    <p className="mt-1 text-[11px] text-slate-400">这里会列出当前落在 `Unsorted` 下面的一级来源目录。</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500 ring-1 ring-slate-200/80">
                    {unsortedImports.length} 个目录
                  </span>
                </div>

                {unsortedImports.length === 0 ? (
                  <div className="mt-3 rounded-xl border border-dashed border-slate-200/80 bg-white/80 px-3 py-3 text-[11px] font-medium text-slate-400">
                    当前 Unsorted 里还没有导入来源目录。
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {unsortedImports.map((item) => (
                      <div
                        key={item.path}
                        className="rounded-xl border border-white/90 bg-white px-3 py-2 shadow-sm"
                        title={item.path}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-[12px] font-bold text-slate-700">{item.label}</p>
                            <p className="mt-0.5 truncate text-[10px] text-slate-400">{item.path}</p>
                          </div>
                          <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600 ring-1 ring-blue-200/80">
                            {item.mangaCount} 本
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
