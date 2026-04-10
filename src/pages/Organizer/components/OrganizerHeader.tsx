import { useCallback } from 'react';
import { ArrowLeft, BookOpen, CheckSquare2, Search, Square, X } from 'lucide-react';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import { cn } from '@renderer/lib/utils';
import { useOrganizerSelectionStore } from '@renderer/stores/organizerSelectionStore';
import type { OrganizerItem, OrganizerSortKey, OrganizerSourceFilterOption, OrganizerStatusFilter } from '../types';

interface OrganizerHeaderProps {
  query: string;
  statusFilter: OrganizerStatusFilter;
  sourceFilter: string;
  sourceOptions: OrganizerSourceFilterOption[];
  sortBy: OrganizerSortKey;
  visibleItems: OrganizerItem[];
  onBack?: () => void;
  onQueryChange: (value: string) => void;
  onStatusFilterChange: (value: OrganizerStatusFilter) => void;
  onSourceFilterChange: (value: string) => void;
  onSortByChange: (value: OrganizerSortKey) => void;
}

export function OrganizerHeader({
  query,
  statusFilter,
  sourceFilter,
  sourceOptions,
  sortBy,
  visibleItems,
  onBack,
  onQueryChange,
  onStatusFilterChange,
  onSourceFilterChange,
  onSortByChange
}: OrganizerHeaderProps) {
  const allVisibleSelected = useOrganizerSelectionStore((state) => {
    if (visibleItems.length === 0 || state.selectedIds.size < visibleItems.length) {
      return false;
    }

    return visibleItems.every((item) => state.selectedIds.has(item.id));
  });

  const toggleSelectAllVisible = useCallback(() => {
    if (visibleItems.length === 0) {
      return;
    }

    const store = useOrganizerSelectionStore.getState();
    const next = new Set(store.selectedIds);
    const shouldClear = visibleItems.every((item) => next.has(item.id));

    if (shouldClear) {
      visibleItems.forEach((item) => next.delete(item.id));
    } else {
      visibleItems.forEach((item) => next.add(item.id));
    }

    store.setSelectedIds(next);
  }, [visibleItems]);

  return (
    <header className="flex h-[64px] items-center justify-between gap-4 border-b border-slate-200/50 bg-white/40 backdrop-blur-2xl px-6">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Button
          variant="secondary"
          className="group h-10 shrink-0 rounded-xl border border-slate-200/60 bg-white/60 px-4 text-[13px] font-bold text-slate-600 shadow-sm transition-all hover:bg-white hover:text-blue-600 focus:ring-2 focus:ring-blue-500/20"
          onClick={onBack}
        >
          <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
          返回主库
        </Button>

        <div className="relative w-[28%] min-w-[200px] max-w-[320px] group">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-500" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            className="h-10 rounded-2xl border-slate-200/60 bg-white/60 pl-10 pr-10 text-[13px] font-medium text-slate-700 shadow-sm transition-all focus:border-blue-500/50 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            placeholder="搜索您整理的漫画名或路径..."
          />
          {query.trim().length > 0 ? (
            <button
              className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
              onClick={() => onQueryChange('')}
              title="清空搜索"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        <select
          value={statusFilter}
          onChange={(event) => onStatusFilterChange(event.target.value as OrganizerStatusFilter)}
          className="h-10 shrink-0 cursor-pointer appearance-none rounded-xl border-slate-200/60 bg-white/60 pl-4 pr-8 text-[13px] font-bold text-slate-600 shadow-sm ring-1 ring-slate-200/50 transition-all hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="all">状态：全面概览</option>
          <option value="organized">状态：已归档</option>
          <option value="unorganized">状态：待整理</option>
        </select>

        <select
          value={sourceFilter}
          onChange={(event) => onSourceFilterChange(event.target.value)}
          className="h-10 min-w-[160px] shrink-0 cursor-pointer appearance-none rounded-xl border-slate-200/60 bg-white/60 pl-4 pr-8 text-[13px] font-bold text-slate-600 shadow-sm ring-1 ring-slate-200/50 transition-all hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          title={sourceFilter === 'all' ? '目录: 全部' : sourceOptions.find((option) => option.path === sourceFilter)?.path ?? sourceFilter}
        >
          <option value="all">目录：全面包含</option>
          {sourceOptions.map((option) => (
            <option key={option.path} value={option.path}>
              目录：{option.label}
            </option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(event) => onSortByChange(event.target.value as OrganizerSortKey)}
          className="h-10 shrink-0 cursor-pointer appearance-none rounded-xl border-slate-200/60 bg-white/60 pl-4 pr-8 text-[13px] font-bold text-slate-600 shadow-sm ring-1 ring-slate-200/50 transition-all hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="addedAt">排序：最近导入</option>
          <option value="title">排序：按标题(A-Z)</option>
          <option value="pages">排序：按总页数</option>
        </select>

        <button
          className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all duration-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20', allVisibleSelected ? 'bg-blue-600 border-blue-600 text-white shadow-blue-500/25 hover:bg-blue-500' : 'bg-white/60 border-slate-200/60 text-slate-500 hover:bg-white hover:text-blue-600')}
          title="全选当前结果"
          onClick={toggleSelectAllVisible}
        >
          {allVisibleSelected ? <CheckSquare2 className="h-5 w-5" /> : <Square className="h-5 w-5" />}
        </button>
      </div>

      <div className="hidden items-center gap-3 2xl:flex">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-sm">
          <BookOpen className="h-4 w-4 text-white" />
        </div>
        <div className="flex flex-col justify-center">
          <p className="text-[18px] font-black leading-none tracking-tight text-slate-800">藏书阁整理</p>
          <p className="max-w-fit mt-1 text-[9px] font-bold tracking-[0.12em] text-slate-400">ORGANIZER</p>
        </div>
      </div>
    </header>
  );
}
