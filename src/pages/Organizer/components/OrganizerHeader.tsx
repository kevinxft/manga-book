import { ArrowLeft, BookOpen, CheckSquare2, Search, Square, X } from 'lucide-react';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import type { OrganizerSortKey, OrganizerStatusFilter } from '../types';

interface OrganizerHeaderProps {
  query: string;
  statusFilter: OrganizerStatusFilter;
  sortBy: OrganizerSortKey;
  allVisibleSelected: boolean;
  onBack?: () => void;
  onQueryChange: (value: string) => void;
  onStatusFilterChange: (value: OrganizerStatusFilter) => void;
  onSortByChange: (value: OrganizerSortKey) => void;
  onToggleSelectAllVisible: () => void;
}

export function OrganizerHeader({
  query,
  statusFilter,
  sortBy,
  allVisibleSelected,
  onBack,
  onQueryChange,
  onStatusFilterChange,
  onSortByChange,
  onToggleSelectAllVisible
}: OrganizerHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-[#d8dde6] bg-[#f7f9fc] px-7 py-3.5">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Button
          variant="secondary"
          className="h-11 shrink-0 rounded-xl border border-[#d7deea] bg-[#edf1f6] px-5 text-[14px] font-semibold text-[#47556c]"
          onClick={onBack}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回
        </Button>

        <div className="relative w-[25%] min-w-[180px] max-w-[280px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8c9bb0]" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            className="h-10 rounded-xl border-[#d8deea] bg-[#ecf0f6] pl-9 pr-9 text-[13px]"
            placeholder="搜索漫画名或路径..."
          />
          {query.trim().length > 0 ? (
            <button
              className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[#70829c] transition hover:bg-[#dfe7f4] hover:text-[#4e607a]"
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
          className="h-10 shrink-0 rounded-xl border border-[#d8deea] bg-[#ecf0f6] px-3 text-[12px] font-semibold text-[#3d4d67] outline-none"
        >
          <option value="all">状态: 全部</option>
          <option value="organized">状态: 已整理</option>
          <option value="unorganized">状态: 未整理</option>
        </select>

        <select
          value={sortBy}
          onChange={(event) => onSortByChange(event.target.value as OrganizerSortKey)}
          className="h-10 shrink-0 rounded-xl border border-[#d8deea] bg-[#ecf0f6] px-3 text-[12px] font-semibold text-[#3d4d67] outline-none"
        >
          <option value="addedAt">排序: 最近导入</option>
          <option value="title">排序: 标题</option>
          <option value="pages">排序: 页数</option>
        </select>

        <button
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#d8deea] bg-[#ecf0f6] text-[#5f708a] hover:bg-[#e6edf6]"
          title="全选当前结果"
          onClick={onToggleSelectAllVisible}
        >
          {allVisibleSelected ? <CheckSquare2 className="h-5 w-5" /> : <Square className="h-5 w-5" />}
        </button>
      </div>

      <div className="hidden items-start gap-2 2xl:flex">
        <BookOpen className="mt-0.5 h-5 w-5 text-[#2563eb]" />
        <div>
          <p className="text-[24px] font-bold leading-none tracking-tight text-[#1e2a3a]">漫画整理</p>
          <p className="mt-1 text-[10px] font-semibold tracking-[0.1em] text-[#7e8a9a]">MANGA ORGANIZER</p>
        </div>
      </div>
    </header>
  );
}
