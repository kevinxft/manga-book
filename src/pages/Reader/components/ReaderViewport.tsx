import { Loader2 } from 'lucide-react';
import type { ReaderMode } from '../types';
import { toPageSrc } from '../utils';

interface ReaderViewportProps {
  readerMode: ReaderMode;
  loading: boolean;
  error: string | null;
  pagePaths: string[];
  currentPageIndex: number;
  effectiveWidth: string;
  mangaTitle: string;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  pageRefs: React.MutableRefObject<Array<HTMLDivElement | null>>;
  onReaderMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  onReaderContextMenu: (event: React.MouseEvent<HTMLDivElement>) => void;
}

export function ReaderViewport({
  readerMode,
  loading,
  error,
  pagePaths,
  currentPageIndex,
  effectiveWidth,
  mangaTitle,
  scrollContainerRef,
  pageRefs,
  onReaderMouseDown,
  onReaderContextMenu
}: ReaderViewportProps) {
  const currentPagePath = pagePaths[currentPageIndex] ?? null;

  return (
    <div
      ref={scrollContainerRef}
      className={
        readerMode === 'scroll'
          ? 'min-h-0 flex-1 overflow-auto bg-black pb-24 pt-0'
          : 'flex min-h-0 flex-1 flex-col bg-black pb-24 pt-0'
      }
    >
      {loading ? (
        <div className="flex h-full items-center justify-center text-[#d1def7]">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          载入漫画中...
        </div>
      ) : null}

      {!loading && error ? (
        <div className="mx-auto w-full max-w-[820px] rounded-xl border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {!loading && !error && pagePaths.length === 0 ? (
        <div className="mx-auto w-full max-w-[820px] rounded-xl border border-dashed border-[#2a2a30] bg-[#101014] px-4 py-8 text-center text-sm text-[#afb4bf]">
          这个目录下没有可显示的图片文件
        </div>
      ) : null}

      {!loading && !error && pagePaths.length > 0 && readerMode === 'scroll' ? (
        <div
          className="mx-auto w-full max-w-full space-y-3 px-4"
          style={{ width: effectiveWidth }}
          onMouseDown={onReaderMouseDown}
          onContextMenu={onReaderContextMenu}
        >
          {pagePaths.map((pagePath, index) => (
            <div
              key={pagePath}
              ref={(node) => {
                pageRefs.current[index] = node;
              }}
              data-page-index={index}
              className="overflow-hidden rounded-sm bg-[#0f0f12]"
            >
              <img
                src={toPageSrc(pagePath)}
                alt={`${mangaTitle} - 第 ${index + 1} 页`}
                loading="lazy"
                className="w-full object-contain"
              />
            </div>
          ))}
        </div>
      ) : null}

      {!loading && !error && pagePaths.length > 0 && readerMode === 'paged' ? (
        <div
          className="flex min-h-0 flex-1 items-center justify-center px-4 py-5"
          onMouseDown={onReaderMouseDown}
          onContextMenu={onReaderContextMenu}
        >
          <div
            className="max-h-full max-w-full overflow-auto rounded-sm bg-[#0f0f12] shadow-[0_10px_28px_rgba(0,0,0,0.6)]"
            style={{ width: effectiveWidth }}
          >
            {currentPagePath ? (
              <img
                src={toPageSrc(currentPagePath)}
                alt={`${mangaTitle} - 第 ${currentPageIndex + 1} 页`}
                className="max-h-[calc(100vh-210px)] w-full object-contain"
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
