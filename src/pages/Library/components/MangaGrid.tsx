import { ImageOff } from 'lucide-react';
import type { MangaBookWithCover } from '@shared/types';
import { getArtistNameFromMangaPath, getMangaDisplayPath, toCoverSrc } from '../utils';

interface MangaGridProps {
  mangas: MangaBookWithCover[];
  totalMangaCount: number;
  loading: boolean;
  onOpenManga?: (manga: MangaBookWithCover) => void;
}

export function MangaGrid({ mangas, totalMangaCount, loading, onOpenManga }: MangaGridProps) {
  return (
    <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))] gap-x-5 gap-y-8">
        {mangas.map((manga) => {
          const artistName = getArtistNameFromMangaPath(manga.folderPath);
          const fullDisplayPath = getMangaDisplayPath(manga.folderPath, manga.sourceFolderPath);

          return (
            <article key={manga.id} title={fullDisplayPath} className="group">
              <button
                className="relative block w-full cursor-pointer overflow-hidden rounded-2xl border-0 bg-[#d8dde6] p-0 text-left shadow-[0_10px_24px_rgba(53,71,95,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6cf6]/40"
                onClick={() => onOpenManga?.(manga)}
                title={`打开：${manga.title}`}
              >
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
                {artistName ? (
                  <span className="absolute left-2 top-2 max-w-[85%] truncate rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">
                    {artistName}
                  </span>
                ) : null}
                <span className="absolute bottom-2 left-2 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">
                  {manga.totalPages} 页
                </span>
              </button>

              <div className="mt-2">
                <p className="truncate text-xs font-semibold leading-tight text-[#1f2b3d]" title={fullDisplayPath}>
                  {manga.title}
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
            {totalMangaCount === 0 ? '点击左下角“导入目录”添加来源后会自动显示。' : '切换到“全部”或调整筛选条件。'}
          </p>
        </div>
      ) : null}
    </div>
  );
}
