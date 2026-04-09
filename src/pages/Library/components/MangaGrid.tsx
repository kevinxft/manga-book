// Force HMR
import { memo, useCallback, useMemo, useState, type MouseEvent } from 'react';
import { BookOpen, Copy, ImageOff, Tag } from 'lucide-react';
import type { DirectoryAlias, MangaBookWithCover } from '@shared/types';
import { CoverContextMenu, type CoverContextMenuState } from '@renderer/components/manga/CoverContextMenu';
import { VirtualCardGrid } from '@renderer/components/virtual/VirtualCardGrid';
import type { OrganizerCategory } from '@renderer/pages/Organizer/types';
import { createAuthorAliasLookup, resolveMangaAuthorInfo } from '@renderer/pages/Organizer/utils';
import {
  getConflictBaseTitle,
  getMangaDisplayPath,
  getParentDirectoryPath,
  toCoverSrc
} from '../utils';

interface MangaGridProps {
  mangas: MangaBookWithCover[];
  totalMangaCount: number;
  loading: boolean;
  quickMoveCategories: OrganizerCategory[];
  targetSourcePaths: string[];
  authorDirectoryPaths: string[];
  aliases: DirectoryAlias[];
  onQuickMoveManga: (mangaId: string, destinationPath: string) => void;
  onAddTagManga: (item: MangaBookWithCover, anchor: { x: number; y: number }) => void;
  onEditManga: (item: MangaBookWithCover) => void;
  onRenameManga: (item: MangaBookWithCover) => void;
  onSearchWeb: (item: MangaBookWithCover, provider: 'hitomi' | 'exhentai' | 'google') => void;
  onOpenInFolder: (mangaId: string) => void;
  onDeleteManga: (item: MangaBookWithCover) => void;
  onOpenManga?: (manga: MangaBookWithCover) => void;
  onVisibleItemsChange?: (items: MangaBookWithCover[]) => void;
}

interface LibraryGridCardData {
  manga: MangaBookWithCover;
  artistName: string | null;
  artistTooltip: string | null;
  missingArtistDirectory: boolean;
  duplicateConflict: boolean;
  fullDisplayPath: string;
  visibleTagNames: string[];
  hiddenTagCount: number;
  hasTags: boolean;
  tagCount: number;
}

const LibraryGridCard = memo(function LibraryGridCard({
  item,
  onContextMenuOpen,
  onAddTagManga,
  onOpenManga
}: {
  item: LibraryGridCardData;
  onContextMenuOpen: (event: MouseEvent<HTMLDivElement>, manga: MangaBookWithCover) => void;
  onAddTagManga: (item: MangaBookWithCover, anchor: { x: number; y: number }) => void;
  onOpenManga?: (manga: MangaBookWithCover) => void;
}) {
  return (
    <article key={item.manga.id} title={item.fullDisplayPath} className="group">
      <div
        className="relative block w-full cursor-pointer overflow-hidden rounded-2xl border border-white/40 bg-slate-100 p-0 text-left shadow-[0_8px_20px_rgba(0,0,0,0.06)] transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_16px_36px_rgba(47,108,246,0.15)] ring-1 ring-slate-900/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
        onContextMenu={(event) => onContextMenuOpen(event, item.manga)}
      >
        <button className="block w-full text-left" onClick={() => onOpenManga?.(item.manga)} title={`打开：${item.manga.title}`}>
          <div className="aspect-[3/4]">
            {item.manga.coverPath ? (
              <img
                src={toCoverSrc(item.manga.coverPath)}
                alt={item.manga.title}
                loading="lazy"
                className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-slate-100 text-slate-300">
                <ImageOff className="h-10 w-10" />
              </div>
            )}
          </div>
        </button>
        <div className="absolute left-2 right-2 top-2 flex items-start justify-between gap-2">
          <span className="shrink-0 rounded-lg bg-black/40 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold tracking-wide text-white shadow-sm ring-1 ring-white/20">
            {item.manga.totalPages} 页
          </span>
          {item.artistName ? (
            <span
              className="min-w-0 max-w-[70%] truncate rounded-lg bg-black/40 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold tracking-wide text-white shadow-sm ring-1 ring-white/20"
              title={item.artistTooltip ?? item.artistName}
            >
              {item.artistName}
            </span>
          ) : null}
        </div>
        <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5">
          {!item.hasTags ? (
            <button
              type="button"
              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-black/50 backdrop-blur-md h-6 w-6 text-white/90 shadow-sm ring-1 ring-white/20 transition-all hover:bg-blue-500 hover:text-white hover:ring-blue-400"
              onClick={(event) => {
                event.stopPropagation();
                const rect = event.currentTarget.getBoundingClientRect();
                onAddTagManga(item.manga, { x: rect.right, y: rect.bottom });
              }}
              title="添加标签"
              aria-label="添加标签"
            >
              <Tag className="h-3 w-3" />
            </button>
          ) : null}
          {item.visibleTagNames.map((name) => (
            <button
              key={`${item.manga.id}-${name}`}
              type="button"
              className="min-w-0 truncate rounded-lg bg-black/50 backdrop-blur-md px-2 h-6 text-[10px] font-bold text-white/95 shadow-sm ring-1 ring-white/20 transition-all hover:bg-blue-500 hover:text-white hover:ring-blue-400"
              onClick={(event) => {
                event.stopPropagation();
                const rect = event.currentTarget.getBoundingClientRect();
                onAddTagManga(item.manga, { x: rect.right, y: rect.bottom });
              }}
              title={name}
              aria-label={`编辑标签：${name}`}
            >
              {name}
            </button>
          ))}
          {item.hiddenTagCount > 0 ? (
            <button
              type="button"
              className="shrink-0 rounded-lg bg-black/50 backdrop-blur-md px-1.5 h-6 text-[10px] font-bold text-white/90 shadow-sm ring-1 ring-white/20 transition-all hover:bg-blue-500 hover:text-white hover:ring-blue-400"
              onClick={(event) => {
                event.stopPropagation();
                const rect = event.currentTarget.getBoundingClientRect();
                onAddTagManga(item.manga, { x: rect.right, y: rect.bottom });
              }}
              title={`编辑标签，当前共 ${item.tagCount} 个`}
              aria-label={`编辑标签，当前共 ${item.tagCount} 个`}
            >
              +{item.hiddenTagCount}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-2.5 px-0.5">
        <p className="flex items-start gap-1.5 text-[13px] font-bold leading-snug text-slate-700 transition-colors group-hover:text-blue-600" title={item.fullDisplayPath}>
          {item.missingArtistDirectory ? (
            <span
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]"
              title="未分配作者目录"
              aria-label="未分配作者目录"
            />
          ) : null}
          {item.duplicateConflict ? (
            <span
              className="mt-0.5 inline-flex shrink-0 text-orange-500"
              title="当前作者目录下存在同名副本"
              aria-label="当前作者目录下存在同名副本"
            >
              <Copy className="h-3.5 w-3.5" />
            </span>
          ) : null}
          <span className="min-w-0 break-words [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden drop-shadow-sm">
            {item.manga.title}
          </span>
        </p>
      </div>
    </article>
  );
});

export function MangaGrid({
  mangas,
  totalMangaCount,
  loading,
  quickMoveCategories,
  targetSourcePaths,
  authorDirectoryPaths,
  aliases,
  onQuickMoveManga,
  onAddTagManga,
  onEditManga,
  onRenameManga,
  onSearchWeb,
  onOpenInFolder,
  onDeleteManga,
  onOpenManga,
  onVisibleItemsChange
}: MangaGridProps) {
  const [contextMenu, setContextMenu] = useState<CoverContextMenuState<MangaBookWithCover> | null>(null);
  const duplicateConflictIds = useMemo(() => {
    const grouped = new Map<string, Array<{ id: string; hasConflictSuffix: boolean }>>();

    for (const manga of mangas) {
      const { baseTitle, hasConflictSuffix } = getConflictBaseTitle(manga.title);
      const parentPath = getParentDirectoryPath(manga.folderPath);
      const key = `${parentPath}::${baseTitle.toLocaleLowerCase()}`;
      const current = grouped.get(key) ?? [];
      current.push({ id: manga.id, hasConflictSuffix });
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
  }, [mangas]);
  const aliasLookup = useMemo(() => (aliases.length > 0 ? createAuthorAliasLookup(aliases) : null), [aliases]);

  const gridItems = useMemo<LibraryGridCardData[]>(
    () =>
      mangas.map((manga) => {
        const authorInfo = resolveMangaAuthorInfo(manga, aliasLookup, targetSourcePaths, authorDirectoryPaths);
        const tagNames = manga.tags.map((tag) => tag.name).filter((name) => name.trim().length > 0);
        const visibleTagNames = tagNames.slice(0, 2);
        return {
          manga,
          artistName: authorInfo?.directoryName ?? null,
          artistTooltip: authorInfo?.tooltipText ?? null,
          missingArtistDirectory: authorInfo === null,
          duplicateConflict: duplicateConflictIds.has(manga.id),
          fullDisplayPath: getMangaDisplayPath(manga.folderPath, manga.sourceFolderPath),
          visibleTagNames,
          hiddenTagCount: Math.max(0, tagNames.length - visibleTagNames.length),
          hasTags: tagNames.length > 0,
          tagCount: tagNames.length
        };
      }),
    [aliasLookup, authorDirectoryPaths, duplicateConflictIds, mangas, targetSourcePaths]
  );

  const handleContextMenuOpen = useCallback((event: MouseEvent<HTMLDivElement>, manga: MangaBookWithCover) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, item: manga });
  }, []);

  const emptyState = !loading ? (
    <div className="flex h-full w-full flex-col items-center justify-center p-8">
      <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/50 px-12 py-16 text-center shadow-sm backdrop-blur-md">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-300">
          <BookOpen className="h-8 w-8" />
        </div>
        <p className="text-[15px] font-bold tracking-wide text-slate-600">
          {totalMangaCount === 0 ? '漫画库空空如也' : '当前没找到匹配的漫画哦'}
        </p>
        <p className="mt-2.5 max-w-[280px] text-[13px] font-medium leading-relaxed text-slate-400">
          {totalMangaCount === 0 ? '赶紧点击左下角的“导入”按钮，添加你的第一个漫画宝库吧！' : '不妨换个标签或者搜索词再试一次。'}
        </p>
      </div>
    </div>
  ) : null;

  return (
    <>
      <VirtualCardGrid
        items={gridItems}
        minColumnWidth={128}
        estimatedCardHeight={(cardWidth) => cardWidth * (4 / 3) + 40}
        gapX={20}
        gapY={24}
        paddingX={24}
        paddingY={20}
        className="min-h-0 flex-1 overflow-auto"
        dataScrollRegion="library-manga-grid"
        emptyState={emptyState}
        onVisibleItemsChange={
          onVisibleItemsChange
            ? (items) => onVisibleItemsChange(items.map((item) => item.manga))
            : undefined
        }
        renderCard={(item) => (
          <LibraryGridCard
            key={item.manga.id}
            item={item}
            onContextMenuOpen={handleContextMenuOpen}
            onAddTagManga={onAddTagManga}
            onOpenManga={onOpenManga}
          />
        )}
      />

      <CoverContextMenu
        menu={contextMenu}
        categories={quickMoveCategories}
        onClose={() => setContextMenu(null)}
        onQuickMove={onQuickMoveManga}
        onAddTag={onAddTagManga}
        onEditPages={onEditManga}
        onRename={onRenameManga}
        onSearchWeb={onSearchWeb}
        onOpenInFolder={onOpenInFolder}
        onDelete={onDeleteManga}
      />
    </>
  );
}
