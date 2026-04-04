import { PanelLeftClose, PanelLeftOpen, RefreshCw, Search } from 'lucide-react';
import { Input } from '@renderer/components/ui/input';
import { cn } from '@renderer/lib/utils';
import type { SortKey } from '../types';

interface LibraryHeaderProps {
  sidebarCollapsed: boolean;
  sortBy: SortKey;
  loading: boolean;
  hasIpcBridge: boolean;
  scanRunning: boolean;
  search: string;
  onSidebarCollapsedChange: (value: boolean) => void;
  onSortByChange: (value: SortKey) => void;
  onSearchChange: (value: string) => void;
  onSyncSources: () => void;
}

export function LibraryHeader({
  sidebarCollapsed,
  sortBy,
  loading,
  hasIpcBridge,
  scanRunning,
  search,
  onSidebarCollapsedChange,
  onSortByChange,
  onSearchChange,
  onSyncSources
}: LibraryHeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-[#dde2eb] bg-[#f1f3f6] px-6">
      <div className="flex items-center gap-4">
        <button
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#dce2ec] bg-[#eceff4] text-[#5f6c80] hover:bg-[#e2e7f0]"
          onClick={() => onSidebarCollapsedChange(!sidebarCollapsed)}
          title={sidebarCollapsed ? '展开侧栏' : '收起侧栏'}
        >
          {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>

        <button
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#dce2ec] bg-[#eceff4] text-[#5f6c80] hover:bg-[#e2e7f0] disabled:opacity-60"
          onClick={onSyncSources}
          disabled={!hasIpcBridge || scanRunning}
          title="重新扫描"
        >
          <RefreshCw className={cn('h-4 w-4', scanRunning && 'animate-spin')} />
        </button>

        <div className="flex items-center gap-2 text-sm font-semibold text-[#4f5d73]">
          <span>排序:</span>
          <select
            className="h-10 rounded-lg border border-[#dce2ec] bg-[#eceff4] px-3 text-sm font-semibold text-[#4f5d73] outline-none hover:bg-[#e2e7f0]"
            value={sortBy}
            onChange={(event) => onSortByChange(event.target.value as SortKey)}
          >
            <option value="addedAtDesc">日期(新-旧)</option>
            <option value="addedAtAsc">日期(旧-新)</option>
            <option value="titleAsc">标题(A-Z)</option>
            <option value="titleDesc">标题(Z-A)</option>
            <option value="lastReadAtDesc">最近阅读</option>
          </select>
        </div>

        {loading ? <span className="text-xs font-semibold text-[#7b8799]">加载中...</span> : null}
      </div>

      <div className="flex items-center gap-1">
        <div className="relative w-[260px] max-w-[32vw]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a95a7]" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="h-10 rounded-lg border-[#dce2ec] bg-[#eceff4] pl-9 text-sm"
            placeholder="搜索漫画、作者或标签..."
          />
        </div>
      </div>
    </header>
  );
}
