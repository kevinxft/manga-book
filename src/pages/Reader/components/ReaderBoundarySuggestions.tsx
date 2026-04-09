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
    <div className="pointer-events-none absolute inset-x-0 bottom-[96px] z-30 flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-[980px] rounded-[22px] border border-black/45 bg-[rgba(0,0,0,0.74)] px-4 py-4 shadow-[0_18px_50px_rgba(0,0,0,0.4)]">
        <p className="text-[12px] font-semibold text-[#eef2f8]">
          {direction === 'next' ? '已经到最后一页了，继续看后面的漫画' : '已经到第一页了，回看前面的漫画'}
        </p>

        <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
          {mangas.map((manga) => (
            <button
              key={manga.id}
              type="button"
              className="w-[124px] shrink-0 text-left"
              onClick={() => onSelect(manga)}
              title={manga.title}
            >
              <div className="overflow-hidden rounded-[18px] border border-white/10 bg-[#14161c] shadow-[0_10px_24px_rgba(0,0,0,0.26)] transition hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_16px_28px_rgba(0,0,0,0.32)]">
                <div className="aspect-[3/4] bg-[#1a1d24]">
                  {manga.coverPath ? (
                    <img
                      src={toCoverSrc(manga.coverPath)}
                      alt={manga.title}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[#8b96aa]">
                      <ImageOff className="h-8 w-8" />
                    </div>
                  )}
                </div>
              </div>
              <p className="mt-2 line-clamp-2 text-[11px] font-semibold leading-4 text-[#eef2f8]">{manga.title}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
