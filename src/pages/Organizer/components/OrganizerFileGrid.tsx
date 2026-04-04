import { useMemo, useState } from 'react';
import { Check, Copy, Eye, ImageOff, Tag } from 'lucide-react';
import { cn } from '@renderer/lib/utils';
import { getConflictBaseTitle, getParentDirectoryPath, toCoverSrc } from '@renderer/pages/Library/utils';
import { CoverContextMenu, type CoverContextMenuState } from '@renderer/components/manga/CoverContextMenu';
import type { OrganizerCategory, OrganizerItem } from '../types';

interface OrganizerFileGridProps {
  loading: boolean;
  error: string | null;
  visibleItems: OrganizerItem[];
  selectedIds: Set<string>;
  categories: OrganizerCategory[];
  onToggleItem: (id: string) => void;
  onQuickMoveManga: (mangaId: string, destinationPath: string) => void;
  onAddTagManga: (item: OrganizerItem, anchor: { x: number; y: number }) => void;
  onRenameManga: (item: OrganizerItem) => void;
  onSearchWeb: (item: OrganizerItem, provider: 'hitomi' | 'exhentai' | 'google') => void;
  onOpenInFolder: (mangaId: string) => void;
  onDeleteManga: (item: OrganizerItem) => void;
  onOpenManga?: (item: OrganizerItem) => void;
}

export function OrganizerFileGrid({
  loading,
  error,
  visibleItems,
  selectedIds,
  categories,
  onToggleItem,
  onQuickMoveManga,
  onAddTagManga,
  onRenameManga,
  onSearchWeb,
  onOpenInFolder,
  onDeleteManga,
  onOpenManga
}: OrganizerFileGridProps) {
  const [contextMenu, setContextMenu] = useState<CoverContextMenuState<OrganizerItem> | null>(null);
  const duplicateConflictIds = useMemo(() => {
    const grouped = new Map<string, Array<{ id: string; hasConflictSuffix: boolean }>>();

    for (const item of visibleItems) {
      const { baseTitle, hasConflictSuffix } = getConflictBaseTitle(item.title);
      const parentPath = getParentDirectoryPath(item.folderPath);
      const key = `${parentPath}::${baseTitle.toLocaleLowerCase()}`;
      const current = grouped.get(key) ?? [];
      current.push({ id: item.id, hasConflictSuffix });
      grouped.set(key, current);
    }

    const markedIds = new Set<string>();
    for (const entries of grouped.values()) {
      if (entries.length < 2) {
        continue;
      }
      for (const entry of entries) {
        if (entry.hasConflictSuffix) {
          markedIds.add(entry.id);
        }
      }
    }

    return markedIds;
  }, [visibleItems]);

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden border-r border-[#dbe1eb] bg-[#f6f8fc]">
      <div className="min-h-0 flex-1 overflow-auto px-7 py-5" data-scroll-region="organizer-file-grid">
        {loading ? <p className="text-sm font-semibold text-[#5f6f89]">加载中...</p> : null}

        {!loading && error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        {!loading && !error ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(164px,1fr))] gap-x-4 gap-y-6">
            {visibleItems.map((item) => {
              const isSelected = selectedIds.has(item.id);
              const duplicateConflict = duplicateConflictIds.has(item.id);
              const tagNames = item.tags.map((tag) => tag.name).filter((name) => name.trim().length > 0);
              const visibleTagNames = tagNames.slice(0, 2);
              const hiddenTagCount = Math.max(0, tagNames.length - visibleTagNames.length);
              const hasTags = tagNames.length > 0;

              return (
                <article key={item.id} className="group" title={item.displayPath}>
                  <div
                    className={cn(
                      'relative block w-full overflow-hidden rounded-xl border bg-[#d9e0ea] text-left shadow-[0_8px_22px_rgba(42,60,88,0.2)] transition',
                      isSelected
                        ? 'border-[#2f7fe6] bg-[#dfe9fb] ring-4 ring-[#2f7fe6]/50 shadow-[0_16px_34px_rgba(47,127,230,0.3)]'
                        : 'border-transparent hover:border-[#b7c8df] hover:shadow-[0_12px_28px_rgba(42,60,88,0.24)]'
                    )}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setContextMenu({ x: event.clientX, y: event.clientY, item });
                    }}
                  >
                    <button className="block w-full text-left" onClick={() => onToggleItem(item.id)}>
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

                    <div className="absolute left-2 right-2 top-2 flex items-start justify-between gap-2 overflow-hidden">
                      {isSelected ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[#2f7fe6] px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-[0_8px_18px_rgba(47,127,230,0.34)]">
                          <Check className="h-3 w-3" />
                          已选
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          {item.totalPages} 页
                        </span>
                      )}
                      {item.ownerBadge ? (
                        <span className="min-w-0 max-w-[70%] truncate rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
                          {item.ownerBadge}
                        </span>
                      ) : null}
                    </div>

                    <div className="absolute bottom-2 left-2 right-8 flex items-center gap-1 overflow-hidden">
                      {!hasTags ? (
                        <button
                          type="button"
                          className="inline-flex shrink-0 items-center gap-1 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-semibold text-white transition hover:bg-black/65"
                          onClick={(event) => {
                            event.stopPropagation();
                            const rect = event.currentTarget.getBoundingClientRect();
                            onAddTagManga(item, { x: rect.right, y: rect.bottom });
                          }}
                          title="添加标签"
                          aria-label="添加标签"
                        >
                          <Tag className="h-3 w-3" />
                        </button>
                      ) : null}
                      {visibleTagNames.map((name) => (
                        <button
                          key={`${item.id}-${name}`}
                          type="button"
                          className="min-w-0 truncate rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-semibold text-white/95 transition hover:bg-[#2f7fe6]/90"
                          onClick={(event) => {
                            event.stopPropagation();
                            const rect = event.currentTarget.getBoundingClientRect();
                            onAddTagManga(item, { x: rect.right, y: rect.bottom });
                          }}
                          title={name}
                          aria-label={`编辑标签：${name}`}
                        >
                          {name}
                        </button>
                      ))}
                      {hiddenTagCount > 0 ? (
                        <button
                          type="button"
                          className="shrink-0 rounded-md bg-black/45 px-1.5 py-0.5 text-[10px] font-semibold text-white/90 transition hover:bg-[#2f7fe6]/80"
                          onClick={(event) => {
                            event.stopPropagation();
                            const rect = event.currentTarget.getBoundingClientRect();
                            onAddTagManga(item, { x: rect.right, y: rect.bottom });
                          }}
                          title={`编辑标签，当前共 ${tagNames.length} 个`}
                          aria-label={`编辑标签，当前共 ${tagNames.length} 个`}
                        >
                          +{hiddenTagCount}
                        </button>
                      ) : null}
                    </div>

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
                  <p className="mt-2 flex items-start gap-1.5 text-[11px] font-semibold leading-tight text-[#1a2840]" title={item.title}>
                    {item.organizeStatus === 'unorganized' ? (
                      <span
                        className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#f59e0b]"
                        title="未分配作者目录"
                        aria-label="未分配作者目录"
                      />
                    ) : null}
                    {duplicateConflict ? (
                      <span
                        className="mt-0.5 inline-flex shrink-0 text-[#f97316]"
                        title="当前作者目录下存在同名副本"
                        aria-label="当前作者目录下存在同名副本"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </span>
                    ) : null}
                    <span className="min-w-0 break-words [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
                      {item.title}
                    </span>
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
      <CoverContextMenu
        menu={contextMenu}
        categories={categories}
        onClose={() => setContextMenu(null)}
        onQuickMove={onQuickMoveManga}
        onAddTag={onAddTagManga}
        onRename={onRenameManga}
        onSearchWeb={onSearchWeb}
        onOpenInFolder={onOpenInFolder}
        onDelete={onDeleteManga}
      />
    </section>
  );
}
