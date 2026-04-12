import { ChevronDown, PanelLeftClose, PanelLeftOpen, RefreshCw, Search, Square, X } from 'lucide-react';
import { Input } from '@renderer/components/ui/input';
import { cn } from '@renderer/lib/utils';
import type { ScanProgress } from '@shared/types';
import type { SortKey } from '../types';

interface LibraryHeaderProps {
  sidebarCollapsed: boolean;
  sortBy: SortKey;
  loading: boolean;
  mangaCount: number;
  hasIpcBridge: boolean;
  scanRunning: boolean;
  progress: ScanProgress;
  search: string;
  onSidebarCollapsedChange: (value: boolean) => void;
  onSortByChange: (value: SortKey) => void;
  onSearchChange: (value: string) => void;
  onSyncSources: () => void;
  onCancelSync: () => void;
}

function getScanPercent(progress: ScanProgress): number {
  if (progress.status !== 'running') {
    return 0;
  }

  const sourceTotal = progress.sourceTotal > 0 ? progress.sourceTotal : progress.total;
  const sourceCurrent = progress.sourceCurrent > 0 ? progress.sourceCurrent : progress.current;
  if (sourceTotal <= 0) {
    return 0;
  }

  if (progress.message === 'Scan finished') {
    return 100;
  }

  const completedSources = Math.max(0, Math.min(sourceTotal, sourceCurrent - 1));
  const currentSourceFraction =
    progress.itemTotal > 0
      ? Math.max(0, Math.min(1, progress.itemCurrent / progress.itemTotal))
      : progress.message.startsWith('No manga found')
        ? 1
        : 0;

  return Math.max(0, Math.min(100, Math.round(((completedSources + currentSourceFraction) / sourceTotal) * 100)));
}

export function LibraryHeader({
  sidebarCollapsed,
  sortBy,
  loading,
  mangaCount,
  hasIpcBridge,
  scanRunning,
  progress,
  search,
  onSidebarCollapsedChange,
  onSortByChange,
  onSearchChange,
  onSyncSources,
  onCancelSync
}: LibraryHeaderProps) {
  const scanPercent = getScanPercent(progress);

  return (
    <header className="app-window-drag relative flex h-[64px] items-center border-b border-slate-200/50 bg-white/40 px-5 backdrop-blur-2xl">
      <div className="app-window-no-drag relative z-10 flex shrink-0 items-center gap-3">
        <div className="flex items-center gap-3">
          <button
            className="group inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/60 text-slate-500 shadow-sm ring-1 ring-slate-200/60 transition-all hover:bg-white hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            onClick={() => onSidebarCollapsedChange(!sidebarCollapsed)}
            title={sidebarCollapsed ? '展开侧栏' : '收起侧栏'}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4 transition-transform group-hover:scale-110" /> : <PanelLeftClose className="h-4 w-4 transition-transform group-hover:scale-110" />}
          </button>

          <button
            className="group inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/60 text-slate-500 shadow-sm ring-1 ring-slate-200/60 transition-all hover:bg-white hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={scanRunning ? onCancelSync : onSyncSources}
            disabled={!hasIpcBridge}
            title={scanRunning ? '停止同步' : '重新扫描'}
          >
            {scanRunning ? <Square className="h-4 w-4 fill-current transition-transform group-hover:scale-95" /> : <RefreshCw className={cn('h-4 w-4 transition-transform group-hover:rotate-180')} />}
          </button>

          {scanRunning ? (
            <div className="min-w-0 rounded-full bg-blue-50 px-3 py-1 text-[12px] font-bold text-blue-700 ring-1 ring-blue-500/10">
              <p className="truncate">
                已扫描 {scanPercent}%
              </p>
            </div>
          ) : null}

          <div className="relative group">
            <select
              className="h-9 appearance-none rounded-xl bg-white/60 pl-4 pr-9 text-[13px] font-semibold text-slate-700 shadow-sm outline-none ring-1 ring-slate-200/60 transition-all hover:bg-white focus:bg-white focus:ring-2 focus:ring-blue-500/20"
              value={sortBy}
              onChange={(event) => onSortByChange(event.target.value as SortKey)}
            >
              <option value="addedAtDesc">日期 (新到旧)</option>
              <option value="addedAtAsc">日期 (旧到新)</option>
              <option value="titleAsc">标题 (A-Z)</option>
              <option value="titleDesc">标题 (Z-A)</option>
              <option value="lastReadAtDesc">最近阅读优先</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-hover:text-blue-500" />
          </div>

          {loading ? <span className="text-[12px] font-bold text-slate-400 animate-pulse">正在加载...</span> : null}
        </div>

      </div>

      <div className="h-full flex-1" />

      <div className="app-window-no-drag relative z-10 flex shrink-0 items-center gap-3">
        <span className="shrink-0 text-[12px] font-bold tracking-wide text-slate-500">
          共 <span className="text-blue-600 font-black text-[12px]">{mangaCount}</span> 本典藏
        </span>
        <div className="relative w-[260px] max-w-[30vw] group">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-500" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className={cn(
              'h-10 rounded-2xl border-slate-200/60 bg-white/60 py-0 pl-10 text-[13px] leading-normal text-slate-700 shadow-sm transition-all focus:border-blue-500/50 focus:bg-white focus:ring-2 focus:ring-blue-500/20',
              search.trim().length > 0 ? '!pr-10' : 'pr-4'
            )}
            placeholder="搜索你想看的漫画"
          />
          {search.trim().length > 0 ? (
            <button
              className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              onClick={() => onSearchChange('')}
              title="清空搜索"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
