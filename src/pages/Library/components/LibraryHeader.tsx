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

function getScanStatusText(progress: ScanProgress): { primary: string; secondary: string } | null {
  if (progress.status !== 'running') {
    return null;
  }

  const primary =
    progress.sourceTotal > 0
      ? `目录 ${Math.max(progress.sourceCurrent, 1)}/${progress.sourceTotal}${progress.sourceName ? ` · ${progress.sourceName}` : ''}`
      : progress.sourceName
        ? `正在准备同步 · ${progress.sourceName}`
        : '正在准备同步...';

  const secondary = progress.currentItemName
    ? `已扫描到 ${progress.currentItemName}${progress.itemTotal > 0 ? ` (${progress.itemCurrent}/${progress.itemTotal})` : ''}`
    : progress.message === 'Queued'
      ? '等待开始同步...'
      : progress.message.startsWith('No manga found')
        ? '当前目录未发现漫画'
        : progress.sourceName
          ? `正在扫描 ${progress.sourceName}`
          : '正在读取目录内容...';

  return { primary, secondary };
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
  const scanStatus = getScanStatusText(progress);

  return (
    <header className="flex h-[52px] items-center justify-between border-b border-[#dde2eb] bg-[#f1f3f6] px-4">
      <div className="flex items-center gap-3">
        <button
          className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-[#dce2ec] bg-[#eceff4] text-[#5f6c80] hover:bg-[#e2e7f0]"
          onClick={() => onSidebarCollapsedChange(!sidebarCollapsed)}
          title={sidebarCollapsed ? '展开侧栏' : '收起侧栏'}
        >
          {sidebarCollapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
        </button>

        <button
          className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-[#dce2ec] bg-[#eceff4] text-[#5f6c80] hover:bg-[#e2e7f0] disabled:opacity-60"
          onClick={scanRunning ? onCancelSync : onSyncSources}
          disabled={!hasIpcBridge}
          title={scanRunning ? '停止同步' : '重新扫描'}
        >
          {scanRunning ? <Square className="h-3.5 w-3.5 fill-current" /> : <RefreshCw className={cn('h-3.5 w-3.5')} />}
        </button>

        {scanStatus ? (
          <div className="min-w-0 max-w-[280px]">
            <p className="truncate text-[11px] font-semibold text-[#3e5c96]">{scanStatus.primary}</p>
            <p className="truncate text-[11px] text-[#6f7e95]">{scanStatus.secondary}</p>
          </div>
        ) : null}

        <div className="flex items-center gap-2.5">
          <span className="text-[12px] font-semibold text-[#617089]">排序:</span>
          <div className="relative">
            <select
              className="h-[34px] appearance-none rounded-[16px] bg-[#eef2f8] pl-3.5 pr-8 text-[12px] font-semibold text-[#4f5d73] outline-none ring-1 ring-inset ring-[#d8e0ec] transition hover:bg-[#e8edf5] focus:bg-white focus:ring-[#b8c8e3]"
              value={sortBy}
              onChange={(event) => onSortByChange(event.target.value as SortKey)}
            >
              <option value="addedAtDesc">日期(新-旧)</option>
              <option value="addedAtAsc">日期(旧-新)</option>
              <option value="titleAsc">标题(A-Z)</option>
              <option value="titleDesc">标题(Z-A)</option>
              <option value="lastReadAtDesc">最近阅读</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7d8ca3]" />
          </div>
        </div>

        {loading ? <span className="text-[11px] font-semibold text-[#7b8799]">加载中...</span> : null}
      </div>

      <div className="flex items-center gap-2.5">
        <span className="shrink-0 text-[12px] font-semibold text-[#617089]">共 {mangaCount} 本</span>
        <div className="relative w-[240px] max-w-[30vw]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a95a7]" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="h-[34px] rounded-lg border-[#dce2ec] bg-[#eceff4] py-0 pl-8 pr-8 text-[12px] leading-normal"
            placeholder="搜索漫画、作者或标签..."
          />
          {search.trim().length > 0 ? (
            <button
              className="absolute right-1.5 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md text-[#70829c] transition hover:bg-[#dfe7f4] hover:text-[#4e607a]"
              onClick={() => onSearchChange('')}
              title="清空搜索"
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
