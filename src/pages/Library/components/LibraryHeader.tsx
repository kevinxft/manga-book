import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Search, SlidersHorizontal } from 'lucide-react';
import { Input } from '@renderer/components/ui/input';
import { cn } from '@renderer/lib/utils';
import type { LibraryStatusFilter, MangaCategoryFilter, SortKey } from '../types';

interface LibraryHeaderProps {
  sortBy: SortKey;
  loading: boolean;
  hasIpcBridge: boolean;
  scanRunning: boolean;
  search: string;
  categoryFilter: MangaCategoryFilter;
  statusFilter: LibraryStatusFilter;
  onSortByChange: (value: SortKey) => void;
  onSearchChange: (value: string) => void;
  onSyncSources: () => void;
  onCategoryFilterChange: (value: MangaCategoryFilter) => void;
  onStatusFilterChange: (value: LibraryStatusFilter) => void;
}

export function LibraryHeader({
  sortBy,
  loading,
  hasIpcBridge,
  scanRunning,
  search,
  categoryFilter,
  statusFilter,
  onSortByChange,
  onSearchChange,
  onSyncSources,
  onCategoryFilterChange,
  onStatusFilterChange
}: LibraryHeaderProps) {
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (filterMenuRef.current && !filterMenuRef.current.contains(target)) {
        setFilterMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, []);

  return (
    <header className="flex h-16 items-center justify-between border-b border-[#dde2eb] bg-[#f1f3f6] px-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#4f5d73]">
          <span>状态:</span>
          <select
            className="rounded-md border border-transparent bg-transparent px-1 py-1 text-sm outline-none hover:border-[#d0d7e3]"
            value={statusFilter}
            onChange={(event) => onStatusFilterChange(event.target.value as LibraryStatusFilter)}
          >
            <option value="all">全部</option>
            <option value="organized">已整理</option>
            <option value="unorganized">未整理</option>
          </select>
        </div>

        <div className="flex items-center gap-2 text-sm font-semibold text-[#4f5d73]">
          <span>排序:</span>
          <select
            className="rounded-md border border-transparent bg-transparent px-1 py-1 text-sm outline-none hover:border-[#d0d7e3]"
            value={sortBy}
            onChange={(event) => onSortByChange(event.target.value as SortKey)}
          >
            <option value="addedAt">日期</option>
            <option value="title">标题</option>
            <option value="lastReadAt">最近阅读</option>
          </select>
        </div>

        {loading ? <span className="text-xs font-semibold text-[#7b8799]">加载中...</span> : null}
      </div>

      <div className="flex items-center gap-1">
        <button
          className="inline-flex h-10 items-center gap-1 rounded-lg border border-[#dce2ec] bg-[#eceff4] px-3 text-xs font-semibold text-[#5f6c80] hover:bg-[#e2e7f0] disabled:opacity-60"
          onClick={onSyncSources}
          disabled={!hasIpcBridge || scanRunning}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', scanRunning && 'animate-spin')} />
          重新扫描
        </button>
        <div className="relative w-[260px] max-w-[32vw]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a95a7]" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="h-10 rounded-lg border-[#dce2ec] bg-[#eceff4] pl-9 text-sm"
            placeholder="搜索漫画、作者或标签..."
          />
        </div>
        <div className="relative" ref={filterMenuRef}>
          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#dce2ec] bg-[#eceff4] text-[#5f6c80] hover:bg-[#e2e7f0]"
            onClick={() => setFilterMenuOpen((prev) => !prev)}
            title="筛选"
          >
            <SlidersHorizontal className="h-4 w-4 text-[#5e6c80]" />
          </button>

          {filterMenuOpen ? (
            <div className="absolute right-0 top-11 z-30 w-40 rounded-lg border border-[#d6deea] bg-white p-1.5 shadow-[0_14px_28px_rgba(48,68,99,0.18)]">
              {[
                { key: 'all' as const, label: '全部' },
                { key: 'artists' as const, label: 'Artists' },
                { key: 'series' as const, label: 'Series' },
                { key: 'other' as const, label: '未整理' }
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => {
                    onCategoryFilterChange(item.key);
                    setFilterMenuOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center rounded-md px-2.5 py-2 text-left text-xs font-semibold transition',
                    categoryFilter === item.key ? 'bg-[#e7efff] text-[#2f6cf6]' : 'text-[#4f5d73] hover:bg-[#edf2f9]'
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
