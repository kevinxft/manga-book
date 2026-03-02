import { CheckSquare2, Eye, ImageOff, Search, Square } from 'lucide-react';
import { Input } from '@renderer/components/ui/input';
import { cn } from '@renderer/lib/utils';
import { toCoverSrc } from '@renderer/pages/Library/utils';
import type { OrganizerItem, OrganizerSortKey, OrganizerStatusFilter } from '../types';

interface OrganizerFileGridProps {
  loading: boolean;
  error: string | null;
  visibleItems: OrganizerItem[];
  selectedIds: Set<string>;
  allVisibleSelected: boolean;
  query: string;
  statusFilter: OrganizerStatusFilter;
  sortBy: OrganizerSortKey;
  onQueryChange: (value: string) => void;
  onStatusFilterChange: (value: OrganizerStatusFilter) => void;
  onSortByChange: (value: OrganizerSortKey) => void;
  onToggleSelectAllVisible: () => void;
  onToggleItem: (id: string) => void;
  onOpenManga?: (item: OrganizerItem) => void;
  onShowContextMenu?: (mangaId: string, x: number, y: number) => void;
}

export function OrganizerFileGrid({
  loading,
  error,
  visibleItems,
  selectedIds,
  allVisibleSelected,
  query,
  statusFilter,
  sortBy,
  onQueryChange,
  onStatusFilterChange,
  onSortByChange,
  onToggleSelectAllVisible,
  onToggleItem,
  onOpenManga,
  onShowContextMenu
}: OrganizerFileGridProps) {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden border-r border-[#dbe1eb] bg-[#f6f8fc]">
      <div className="shrink-0 border-b border-[#d9dfe9] px-7 py-4">
        <div className="flex items-center gap-3">
          <div className="relative w-[54%] min-w-[260px] max-w-[560px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8c9bb0]" />
            <Input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              className="h-10 rounded-xl border-[#d8deea] bg-[#ecf0f6] pl-9 text-[13px]"
              placeholder="搜索漫画名或路径..."
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => onStatusFilterChange(event.target.value as OrganizerStatusFilter)}
            className="h-10 rounded-xl border border-[#d8deea] bg-[#ecf0f6] px-3 text-[12px] font-semibold text-[#3d4d67] outline-none"
          >
            <option value="all">状态: 全部</option>
            <option value="organized">状态: 已整理</option>
            <option value="unorganized">状态: 未整理</option>
          </select>

          <select
            value={sortBy}
            onChange={(event) => onSortByChange(event.target.value as OrganizerSortKey)}
            className="h-10 rounded-xl border border-[#d8deea] bg-[#ecf0f6] px-3 text-[12px] font-semibold text-[#3d4d67] outline-none"
          >
            <option value="addedAt">排序: 最近导入</option>
            <option value="title">排序: 标题</option>
            <option value="pages">排序: 页数</option>
          </select>

          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#d8deea] bg-[#ecf0f6] text-[#5f708a] hover:bg-[#e6edf6]"
            title="全选当前结果"
            onClick={onToggleSelectAllVisible}
          >
            {allVisibleSelected ? <CheckSquare2 className="h-5 w-5" /> : <Square className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-7 py-5">
        {loading ? <p className="text-sm font-semibold text-[#5f6f89]">加载中...</p> : null}

        {!loading && error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        {!loading && !error ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(164px,1fr))] gap-x-4 gap-y-6">
            {visibleItems.map((item) => {
              const isSelected = selectedIds.has(item.id);

              return (
                <article key={item.id} className="group" title={item.displayPath}>
                  <div
                    className={cn(
                      'relative block w-full overflow-hidden rounded-xl border bg-[#d9e0ea] text-left shadow-[0_8px_22px_rgba(42,60,88,0.2)] transition',
                      isSelected
                        ? 'border-[#2f7fe6] ring-2 ring-[#2f7fe6]/45'
                        : 'border-transparent hover:border-[#b7c8df] hover:shadow-[0_12px_28px_rgba(42,60,88,0.24)]'
                    )}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      onShowContextMenu?.(item.id, event.clientX, event.clientY);
                    }}
                  >
                    <button
                      className="block w-full text-left"
                      onClick={() => onToggleItem(item.id)}
                    >
                      <div className="aspect-[3/4]">
                        {item.coverPath ? (
                          <img
                            src={toCoverSrc(item.coverPath)}
                            alt={item.title}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center bg-[#d3dfef] text-[#6fa4de]">
                            <ImageOff className="h-8 w-8" />
                          </div>
                        )}
                      </div>
                    </button>

                    {item.ownerBadge ? (
                      <span className="absolute left-2 top-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
                        {item.ownerBadge}
                      </span>
                    ) : null}

                    {isSelected ? (
                      <span className="absolute right-2 top-2 rounded-md bg-[#2f7fe6] px-2 py-0.5 text-[10px] font-semibold text-white">
                        已勾选
                      </span>
                    ) : null}

                    <span className="absolute bottom-2 left-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {item.totalPages} 页
                    </span>

                    {onOpenManga ? (
                      <button
                        className="absolute bottom-2 right-2 inline-flex h-6 w-6 items-center justify-center rounded-md bg-black/55 text-white transition hover:bg-black/70"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenManga(item);
                        }}
                        title="预览漫画"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                  <p className="mt-2 truncate text-[14px] font-semibold leading-tight text-[#1a2840]" title={item.title}>
                    {item.title}
                  </p>
                </article>
              );
            })}
          </div>
        ) : null}

        {!loading && !error && visibleItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#c6d2e2] bg-white/70 px-5 py-12 text-center text-sm text-[#6d7f99]">
            当前没有匹配到待整理漫画
          </div>
        ) : null}
      </div>
    </section>
  );
}
