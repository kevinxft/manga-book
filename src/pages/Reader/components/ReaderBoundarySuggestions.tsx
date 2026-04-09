import { ImageOff } from 'lucide-react';
import type { MangaBookWithCover } from '@shared/types';
import { toCoverSrc } from '@renderer/pages/Library/utils';

interface ReaderBoundarySuggestionsProps {
  direction: 'prev' | 'next';
  mangas: MangaBookWithCover[];
  onSelect: (manga: MangaBookWithCover) => void;
}

export function ReaderBoundarySuggestions({ direction, mangas, onSelect }: ReaderBoundarySuggestionsProps) {
  if (mangas.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[110px] z-30 flex justify-center px-4">
      <div className="pointer-events-auto w-fit min-w-[min(100%,720px)] max-w-full rounded-3xl border border-white/10 bg-[#0f1115]/80 px-6 py-5 shadow-[0_24px_48px_rgba(0,0,0,0.5)] backdrop-blur-xl">
        <p className="text-[13px] font-bold tracking-wide text-white drop-shadow-sm">
          {direction === 'next' ? '已经到最后一页啦，继续看后面的漫画' : '已经到第一页啦，回看前面的漫画'}
        </p>

        <div className="mt-4 flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
          {mangas.map((manga) => (
            <button
              key={manga.id}
              type="button"
              className="group w-[124px] shrink-0 text-left focus:outline-none"
              onClick={() => onSelect(manga)}
              title={manga.title}
            >
              <div className="overflow-hidden rounded-[20px] border border-white/5 bg-[#171921] shadow-[0_10px_20px_rgba(0,0,0,0.3)] transition-all duration-300 group-hover:-translate-y-1.5 group-hover:border-white/20 group-hover:shadow-[0_16px_36px_rgba(61,124,249,0.2)]">
                <div className="aspect-[3/4] bg-[#1d2029]">
                  {manga.coverPath ? (
                    <img
                      src={toCoverSrc(manga.coverPath)}
                      alt={manga.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[#556379]">
                      <ImageOff className="h-8 w-8" />
                    </div>
                  )}
                </div>
              </div>
              <p className="mt-2.5 line-clamp-2 text-[11px] font-medium leading-[1.4] text-[#a3b1c6] transition-colors group-hover:text-white">
                {manga.title}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
