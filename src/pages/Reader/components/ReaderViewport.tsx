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
          ? 'min-h-0 flex-1 overflow-auto bg-black custom-scrollbar scroll-smooth'
          : 'flex min-h-0 flex-1 flex-col bg-black pt-[64px] pb-[80px]'
      }
    >
      {loading ? (
        <div className="flex h-full flex-col items-center justify-center text-[#d1def7]">
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-[#3d7cf9]" />
          <span className="text-[14px] font-medium tracking-wide text-[#a3b1c6]">正为您载入漫画...</span>
        </div>
      ) : null}

      {!loading && error ? (
        <div className="mx-auto mt-24 w-full max-w-[820px] rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm font-medium text-red-200 backdrop-blur-md">
          {error}
        </div>
      ) : null}

      {!loading && !error && pagePaths.length === 0 ? (
        <div className="mx-auto flex h-[calc(100vh-144px)] mt-16 w-full max-w-[820px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-[#101014] px-6 text-center shadow-lg">
          <p className="text-[15px] font-medium text-[#7b8191]">此漫画暂无任何页面或图片文件</p>
        </div>
      ) : null}

      {!loading && !error && pagePaths.length > 0 && readerMode === 'scroll' ? (
        <div
          className="mx-auto w-full max-w-full space-y-4 px-4 pt-[96px] pb-[112px]"
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
              className="overflow-hidden rounded-xl bg-[#0f0f12] shadow-md ring-1 ring-white/5 transition-shadow hover:shadow-lg"
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
          className="flex min-h-0 flex-1 items-center justify-center px-6 py-6"
          onMouseDown={onReaderMouseDown}
          onContextMenu={onReaderContextMenu}
        >
          <div
            className="flex max-w-full items-center justify-center overflow-hidden rounded-xl bg-[#0a0a0c] shadow-[0_20px_60px_rgba(0,0,0,0.8)] ring-1 ring-white/5"
            style={{ width: effectiveWidth }}
          >
            {currentPagePath ? (
              <img
                src={toPageSrc(currentPagePath)}
                alt={`${mangaTitle} - 第 ${currentPageIndex + 1} 页`}
                className="max-h-[calc(100vh-192px)] w-full object-contain"
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
