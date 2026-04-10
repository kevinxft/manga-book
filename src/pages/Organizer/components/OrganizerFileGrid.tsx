import { memo, useCallback, useMemo, useState, type MouseEvent } from 'react';
import { Check, Copy, Eye, ImageOff, Tag } from 'lucide-react';
import { VirtualCardGrid } from '@renderer/components/virtual/VirtualCardGrid';
import { cn } from '@renderer/lib/utils';
import { getConflictBaseTitle, getParentDirectoryPath, toCoverSrc } from '@renderer/pages/Library/utils';
import { CoverContextMenu, type CoverContextMenuState } from '@renderer/components/manga/CoverContextMenu';
import { useOrganizerSelectionStore } from '@renderer/stores/organizerSelectionStore';
import type { OrganizerCategory, OrganizerItem } from '../types';

interface OrganizerFileGridProps {
  loading: boolean;
  error: string | null;
  visibleItems: OrganizerItem[];
  categories: OrganizerCategory[];
  onToggleItem: (id: string) => void;
  onQuickMoveManga: (mangaId: string, destinationPath: string) => void;
  onAddTagManga: (item: OrganizerItem, anchor: { x: number; y: number }) => void;
  onRenameManga: (item: OrganizerItem) => void;
  onSearchWeb: (item: OrganizerItem, provider: 'hitomi' | 'exhentai' | 'google') => void;
  onOpenInFolder: (mangaId: string) => void;
  onDeleteManga: (item: OrganizerItem) => void;
  onOpenManga?: (item: OrganizerItem) => void;
  onVisibleItemsChange?: (items: OrganizerItem[]) => void;
}

interface OrganizerGridCardData {
  item: OrganizerItem;
  duplicateConflict: boolean;
  visibleTagNames: string[];
  hiddenTagCount: number;
  hasTags: boolean;
  tagCount: number;
}

const OrganizerGridCard = memo(function OrganizerGridCard({
  card,
  onToggleItem,
  onContextMenuOpen,
  onAddTagManga,
  onOpenManga
}: {
  card: OrganizerGridCardData;
  onToggleItem: (id: string) => void;
  onContextMenuOpen: (event: MouseEvent<HTMLDivElement>, item: OrganizerItem) => void;
  onAddTagManga: (item: OrganizerItem, anchor: { x: number; y: number }) => void;
  onOpenManga?: (item: OrganizerItem) => void;
}) {
  const isSelected = useOrganizerSelectionStore((state) => state.selectedIds.has(card.item.id));
  return (
    <article key={card.item.id} className="group" title={card.item.displayPath}>
      <div
        className={cn(
          'relative block w-full overflow-hidden rounded-2xl border text-left transition-all duration-150 ease-out',
          isSelected
            ? 'border-blue-500 bg-blue-100 ring-4 ring-blue-500/30 shadow-[0_12px_24px_rgba(47,108,246,0.25)] scale-[1.02]'
            : 'border-white/60 bg-slate-100 ring-1 ring-slate-900/5 shadow-[0_8px_20px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_36px_rgba(47,108,246,0.12)] hover:-translate-y-1'
        )}
        onContextMenu={(event) => onContextMenuOpen(event, card.item)}
      >
        <button className="block w-full text-left" onClick={() => onToggleItem(card.item.id)}>
          <div className="aspect-[3/4]">
            {card.item.coverPath ? (
              <img
                src={toCoverSrc(card.item.coverPath)}
                alt={card.item.title}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-slate-100 text-slate-300">
                <ImageOff className="h-10 w-10" />
              </div>
            )}
          </div>
        </button>

        <div className="absolute left-2 right-2 top-2 flex items-start justify-between gap-2">
          {isSelected ? (
            <span className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg bg-blue-600 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white shadow-md ring-1 ring-white/20">
              <Check className="h-3 w-3" />
              已选
            </span>
          ) : (
            <span className="shrink-0 rounded-lg bg-black/40 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold tracking-wide text-white shadow-sm ring-1 ring-white/20">
              {card.item.totalPages} 页
            </span>
          )}
          {card.item.ownerBadge ? (
            <span className="min-w-0 max-w-[70%] truncate rounded-lg bg-black/40 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold tracking-wide text-white shadow-sm ring-1 ring-white/20">
              {card.item.ownerBadge}
            </span>
          ) : null}
        </div>

        <div className="absolute bottom-2 left-2 right-8 flex items-center gap-1.5">
          {!card.hasTags ? (
            <button
              type="button"
              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-black/50 backdrop-blur-md h-6 w-6 text-white/90 shadow-sm ring-1 ring-white/20 transition-all hover:bg-blue-500 hover:text-white hover:ring-blue-400"
              onClick={(event) => {
                event.stopPropagation();
                const rect = event.currentTarget.getBoundingClientRect();
                onAddTagManga(card.item, { x: rect.right, y: rect.bottom });
              }}
              title="添加标签"
              aria-label="添加标签"
            >
              <Tag className="h-3 w-3" />
            </button>
          ) : null}
          {card.visibleTagNames.map((name) => (
            <button
              key={`${card.item.id}-${name}`}
              type="button"
              className="min-w-0 truncate rounded-lg bg-black/50 backdrop-blur-md px-2 h-6 text-[10px] font-bold text-white/95 shadow-sm ring-1 ring-white/20 transition-all hover:bg-blue-500 hover:text-white hover:ring-blue-400"
              onClick={(event) => {
                event.stopPropagation();
                const rect = event.currentTarget.getBoundingClientRect();
                onAddTagManga(card.item, { x: rect.right, y: rect.bottom });
              }}
              title={name}
              aria-label={`编辑标签：${name}`}
            >
              {name}
            </button>
          ))}
          {card.hiddenTagCount > 0 ? (
            <button
              type="button"
              className="shrink-0 rounded-lg bg-black/50 backdrop-blur-md px-1.5 h-6 text-[10px] font-bold text-white/90 shadow-sm ring-1 ring-white/20 transition-all hover:bg-blue-500 hover:text-white hover:ring-blue-400"
              onClick={(event) => {
                event.stopPropagation();
                const rect = event.currentTarget.getBoundingClientRect();
                onAddTagManga(card.item, { x: rect.right, y: rect.bottom });
              }}
              title={`编辑标签，当前共 ${card.tagCount} 个`}
              aria-label={`编辑标签，当前共 ${card.tagCount} 个`}
            >
              +{card.hiddenTagCount}
            </button>
          ) : null}
        </div>

        {onOpenManga ? (
          <button
            className="absolute bottom-2 right-2 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-black/50 backdrop-blur-md text-white/90 shadow-sm ring-1 ring-white/20 transition-all hover:bg-blue-500 hover:text-white hover:ring-blue-400"
            onClick={(event) => {
              event.stopPropagation();
              onOpenManga(card.item);
            }}
            title="预览漫画"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      <div className="mt-2.5 px-1">
        <p className="flex items-start gap-1.5 text-[13px] font-bold leading-snug text-slate-700 transition-colors group-hover:text-blue-600" title={card.item.title}>
          {card.item.organizeStatus === 'unorganized' ? (
            <span
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]"
              title="未分配作者目录"
              aria-label="未分配作者目录"
            />
          ) : null}
          {card.duplicateConflict ? (
            <span
              className="mt-0.5 inline-flex shrink-0 text-orange-500"
              title="当前作者目录下存在同名副本"
              aria-label="当前作者目录下存在同名副本"
            >
              <Copy className="h-3.5 w-3.5" />
            </span>
          ) : null}
          <span className="min-w-0 break-words [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden drop-shadow-sm">
            {card.item.title}
          </span>
        </p>
      </div>
    </article>
  );
});

export function OrganizerFileGrid({
  loading,
  error,
  visibleItems,
  categories,
  onToggleItem,
  onQuickMoveManga,
  onAddTagManga,
  onRenameManga,
  onSearchWeb,
  onOpenInFolder,
  onDeleteManga,
  onOpenManga,
  onVisibleItemsChange
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

  const gridItems = useMemo<OrganizerGridCardData[]>(
    () =>
      visibleItems.map((item) => {
        const tagNames = item.tags.map((tag) => tag.name).filter((name) => name.trim().length > 0);
        const visibleTagNames = tagNames.slice(0, 2);
        return {
          item,
          duplicateConflict: duplicateConflictIds.has(item.id),
          visibleTagNames,
          hiddenTagCount: Math.max(0, tagNames.length - visibleTagNames.length),
          hasTags: tagNames.length > 0,
          tagCount: tagNames.length
        };
      }),
    [duplicateConflictIds, visibleItems]
  );

  const handleContextMenuOpen = useCallback((event: MouseEvent<HTMLDivElement>, item: OrganizerItem) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, item });
  }, []);

  const emptyState = !loading && !error ? (
    <div className="flex h-full w-full flex-col items-center justify-center p-8">
      <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/40 px-12 py-16 text-center shadow-sm backdrop-blur-md">
        <p className="text-[15px] font-bold tracking-wide text-slate-600">
          当前没有匹配到待整理漫画
        </p>
      </div>
    </div>
  ) : null;

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden shadow-inner bg-slate-50/40">
      {loading ? <p className="px-7 pt-5 text-[13px] font-bold text-slate-500">加载中...</p> : null}

      {!loading && error ? (
        <div className="px-7 py-5">
          <div className="rounded-xl border border-red-200 bg-red-50/80 backdrop-blur-sm px-4 py-3 text-[13px] font-medium text-red-700">{error}</div>
        </div>
      ) : null}

      {!error ? (
        <VirtualCardGrid
          items={gridItems}
          minColumnWidth={128}
          estimatedCardHeight={(cardWidth) => cardWidth * (4 / 3) + 40}
          gapX={20}
          gapY={24}
          paddingX={24}
          paddingY={20}
          className="min-h-0 flex-1 overflow-auto"
          dataScrollRegion="organizer-file-grid"
          emptyState={emptyState}
          onVisibleItemsChange={
            onVisibleItemsChange
              ? (items) => onVisibleItemsChange(items.map((item) => item.item))
              : undefined
          }
          renderCard={(card) => (
            <OrganizerGridCard
              key={card.item.id}
              card={card}
              onToggleItem={onToggleItem}
              onContextMenuOpen={handleContextMenuOpen}
              onAddTagManga={onAddTagManga}
              onOpenManga={onOpenManga}
            />
          )}
        />
      ) : null}

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
