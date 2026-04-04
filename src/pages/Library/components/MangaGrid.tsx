import { useMemo, useState } from 'react';
import { Copy, ImageOff, Tag } from 'lucide-react';
import type { MangaBookWithCover } from '@shared/types';
import { CoverContextMenu, type CoverContextMenuState } from '@renderer/components/manga/CoverContextMenu';
import type { OrganizerCategory } from '@renderer/pages/Organizer/types';
import {
  getArtistNameFromMangaPath,
  getConflictBaseTitle,
  getMangaDisplayPath,
  getMangaPathCategory,
  getParentDirectoryPath,
  toCoverSrc
} from '../utils';

interface MangaGridProps {
  mangas: MangaBookWithCover[];
  totalMangaCount: number;
  loading: boolean;
  quickMoveCategories: OrganizerCategory[];
  onQuickMoveManga: (mangaId: string, destinationPath: string) => void;
  onAddTagManga: (item: MangaBookWithCover, anchor: { x: number; y: number }) => void;
  onRenameManga: (item: MangaBookWithCover) => void;
  onSearchWeb: (item: MangaBookWithCover, provider: 'hitomi' | 'exhentai' | 'google') => void;
  onOpenInFolder: (mangaId: string) => void;
  onDeleteManga: (item: MangaBookWithCover) => void;
  onOpenManga?: (manga: MangaBookWithCover) => void;
}

export function MangaGrid({
  mangas,
  totalMangaCount,
  loading,
  quickMoveCategories,
  onQuickMoveManga,
  onAddTagManga,
  onRenameManga,
  onSearchWeb,
  onOpenInFolder,
  onDeleteManga,
  onOpenManga
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

  return (
    <div className="min-h-0 flex-1 overflow-auto px-6 py-5" data-scroll-region="library-manga-grid">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))] gap-x-5 gap-y-8">
        {mangas.map((manga) => {
          const artistName = getArtistNameFromMangaPath(manga.folderPath);
          const missingArtistDirectory = getMangaPathCategory(manga.folderPath, manga.sourceFolderPath) !== 'artists';
          const duplicateConflict = duplicateConflictIds.has(manga.id);
          const fullDisplayPath = getMangaDisplayPath(manga.folderPath, manga.sourceFolderPath);
          const tagNames = manga.tags.map((tag) => tag.name).filter((name) => name.trim().length > 0);
          const visibleTagNames = tagNames.slice(0, 2);
          const hiddenTagCount = Math.max(0, tagNames.length - visibleTagNames.length);
          const hasTags = tagNames.length > 0;

          return (
            <article key={manga.id} title={fullDisplayPath} className="group">
              <div
                className="relative block w-full cursor-pointer overflow-hidden rounded-2xl border-0 bg-[#d8dde6] p-0 text-left shadow-[0_10px_24px_rgba(53,71,95,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6cf6]/40"
                onContextMenu={(event) => {
                  event.preventDefault();
                  setContextMenu({ x: event.clientX, y: event.clientY, item: manga });
                }}
              >
                <button className="block w-full text-left" onClick={() => onOpenManga?.(manga)} title={`打开：${manga.title}`}>
                  <div className="aspect-[3/4]">
                    {manga.coverPath ? (
                      <img
                        src={toCoverSrc(manga.coverPath)}
                        alt={manga.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-[#dce2ec] text-[#8a96a8]">
                        <ImageOff className="h-10 w-10" />
                      </div>
                    )}
                  </div>
                </button>
                <div className="absolute left-2 right-2 top-2 flex items-start justify-between gap-2">
                  <span className="shrink-0 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">
                    {manga.totalPages} 页
                  </span>
                  {artistName ? (
                    <span
                      className="min-w-0 max-w-[70%] truncate rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white"
                      title={artistName}
                    >
                      {artistName}
                    </span>
                  ) : null}
                </div>
                <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1 overflow-hidden">
                  {!hasTags ? (
                    <button
                      type="button"
                      className="inline-flex shrink-0 items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white transition hover:bg-black/75"
                      onClick={(event) => {
                        event.stopPropagation();
                        const rect = event.currentTarget.getBoundingClientRect();
                        onAddTagManga(manga, { x: rect.right, y: rect.bottom });
                      }}
                      title="添加标签"
                      aria-label="添加标签"
                    >
                      <Tag className="h-3 w-3" />
                    </button>
                  ) : null}
                  {visibleTagNames.map((name) => (
                    <button
                      key={`${manga.id}-${name}`}
                      type="button"
                      className="min-w-0 truncate rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white/95 transition hover:bg-[#2f7fe6]/90"
                      onClick={(event) => {
                        event.stopPropagation();
                        const rect = event.currentTarget.getBoundingClientRect();
                        onAddTagManga(manga, { x: rect.right, y: rect.bottom });
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
                      className="shrink-0 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white/90 transition hover:bg-[#2f7fe6]/80"
                      onClick={(event) => {
                        event.stopPropagation();
                        const rect = event.currentTarget.getBoundingClientRect();
                        onAddTagManga(manga, { x: rect.right, y: rect.bottom });
                      }}
                      title={`编辑标签，当前共 ${tagNames.length} 个`}
                      aria-label={`编辑标签，当前共 ${tagNames.length} 个`}
                    >
                      +{hiddenTagCount}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-2">
                <p className="flex items-start gap-1.5 text-xs font-semibold leading-tight text-[#1f2b3d]" title={fullDisplayPath}>
                  {missingArtistDirectory ? (
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
                      <Copy className="h-3 w-3" />
                    </span>
                  ) : null}
                  <span className="min-w-0 break-words [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
                    {manga.title}
                  </span>
                </p>
              </div>
            </article>
          );
        })}
      </div>

      {!loading && mangas.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-[#cfd7e4] bg-[#f7f9fc] px-6 py-10 text-center">
          <p className="text-sm font-semibold text-[#46546a]">{totalMangaCount === 0 ? '当前没有漫画数据' : '当前筛选下没有漫画'}</p>
          <p className="mt-2 text-xs text-[#7d889c]">
            {totalMangaCount === 0 ? '点击左下角“导入目录”添加来源后会自动显示。' : '请调整分类或标签筛选条件。'}
          </p>
        </div>
      ) : null}

      <CoverContextMenu
        menu={contextMenu}
        categories={quickMoveCategories}
        onClose={() => setContextMenu(null)}
        onQuickMove={onQuickMoveManga}
        onAddTag={onAddTagManga}
        onRename={onRenameManga}
        onSearchWeb={onSearchWeb}
        onOpenInFolder={onOpenInFolder}
        onDelete={onDeleteManga}
      />
    </div>
  );
}
