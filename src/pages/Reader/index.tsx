import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Loader2, Minus, Plus } from 'lucide-react';
import type { MangaBookWithCover } from '@shared/types';
import { ipcInvoke } from '@renderer/ipc/client';
import { cn } from '@renderer/lib/utils';

export type ReaderMode = 'paged' | 'scroll';
export type ReaderWidthMode = 'fit' | 'fixed';
const MIN_FIXED_WIDTH_PERCENT = 50;
const MAX_FIXED_WIDTH_PERCENT = 100;

interface ReaderPageProps {
  manga: MangaBookWithCover;
  readerMode: ReaderMode;
  widthMode: ReaderWidthMode;
  fixedWidthPercent: number;
  pageAnimationEnabled: boolean;
  onReaderModeChange: (mode: ReaderMode) => void;
  onWidthModeChange: (mode: ReaderWidthMode) => void;
  onFixedWidthPercentChange: (value: number) => void;
  onBack: () => void;
}

function toPageSrc(filePath: string): string {
  return `manga-cover://local-image?path=${encodeURIComponent(filePath)}`;
}

export function ReaderPage({
  manga,
  readerMode,
  widthMode,
  fixedWidthPercent,
  pageAnimationEnabled,
  onReaderModeChange,
  onWidthModeChange,
  onFixedWidthPercentChange,
  onBack
}: ReaderPageProps) {
  const [pagePaths, setPagePaths] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const hasIpcBridge = typeof window !== 'undefined' && typeof window.mangaBookApi?.invoke === 'function';
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);
  const maxPageIndex = Math.max(pagePaths.length - 1, 0);
  const pageStep = 1;

  useEffect(() => {
    pageRefs.current = [];
  }, [manga.id]);

  const movePage = useCallback(
    (delta: number) => {
      if (pagePaths.length === 0) {
        return;
      }

      setCurrentPageIndex((prev) => {
        const next = Math.max(0, Math.min(prev + delta, maxPageIndex));
        if (readerMode === 'scroll' && next !== prev) {
          const targetNode = pageRefs.current[next];
          if (targetNode) {
            requestAnimationFrame(() => {
              targetNode.scrollIntoView({
                block: 'start',
                behavior: pageAnimationEnabled ? 'smooth' : 'auto'
              });
            });
          }
        }
        return next;
      });
    },
    [maxPageIndex, pageAnimationEnabled, pagePaths.length, readerMode]
  );

  const handleReaderMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.button === 0) {
        event.preventDefault();
        movePage(pageStep);
      } else if (event.button === 2) {
        event.preventDefault();
        movePage(-pageStep);
      }
    },
    [movePage, pageStep]
  );

  const handleReaderContextMenu = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  const handleToolbarButtonMouseDown = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  }, []);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onBack();
        return;
      }

      if (event.code === 'Space' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLElement && activeElement.tagName === 'BUTTON') {
          activeElement.blur();
        }
        movePage(event.shiftKey ? -pageStep : pageStep);
      } else if (event.code === 'KeyD' || event.code === 'KeyS') {
        event.preventDefault();
        movePage(pageStep);
      } else if (event.code === 'KeyA' || event.code === 'KeyW') {
        event.preventDefault();
        movePage(-pageStep);
      } else if (readerMode === 'scroll' && event.key === 'ArrowDown') {
        event.preventDefault();
        movePage(1);
      } else if (readerMode === 'scroll' && event.key === 'ArrowUp') {
        event.preventDefault();
        movePage(-1);
      } else if (event.key === 'ArrowRight' || event.key === 'PageDown') {
        event.preventDefault();
        movePage(pageStep);
      } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault();
        movePage(-pageStep);
      } else if (event.key === 'f' || event.key === 'F') {
        event.preventDefault();
        onWidthModeChange(widthMode === 'fit' ? 'fixed' : 'fit');
      }
    };

    window.addEventListener('keydown', handleKeydown, true);
    return () => window.removeEventListener('keydown', handleKeydown, true);
  }, [movePage, onBack, onWidthModeChange, pageStep, widthMode, readerMode]);

  useEffect(() => {
    if (!hasIpcBridge) {
      setLoading(false);
      setError('当前运行在普通浏览器环境，无法读取漫画页面。请使用 bun run dev 启动 Electron。');
      return;
    }

    let cancelled = false;

    const loadPages = async () => {
      setLoading(true);
      setError(null);
      try {
        const pages = await ipcInvoke('reader.listPages', { mangaId: manga.id });
        if (cancelled) return;
        setPagePaths(pages);
        const initialIndex = Math.max(0, Math.min(manga.lastPageIndex, Math.max(pages.length - 1, 0)));
        setCurrentPageIndex(initialIndex);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : '加载漫画页面失败');
        setPagePaths([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadPages();
    return () => {
      cancelled = true;
    };
  }, [hasIpcBridge, manga.id, manga.lastPageIndex]);

  useEffect(() => {
    if (readerMode !== 'scroll' || pagePaths.length === 0) return;
    const targetIndex = Math.max(0, Math.min(manga.lastPageIndex, pagePaths.length - 1));
    const targetNode = pageRefs.current[targetIndex];
    if (!targetNode) return;
    requestAnimationFrame(() => {
      targetNode.scrollIntoView({ block: 'start' });
    });
  }, [manga.lastPageIndex, pagePaths, readerMode]);

  useEffect(() => {
    if (readerMode !== 'scroll') {
      return;
    }

    const root = scrollContainerRef.current;
    if (!root || pagePaths.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let maxRatio = 0;
        let nextIndex: number | null = null;
        for (const entry of entries) {
          if (!entry.isIntersecting || entry.intersectionRatio < maxRatio) {
            continue;
          }
          const index = Number((entry.target as HTMLElement).dataset.pageIndex);
          if (Number.isNaN(index)) {
            continue;
          }
          maxRatio = entry.intersectionRatio;
          nextIndex = index;
        }
        if (nextIndex !== null) {
          setCurrentPageIndex(nextIndex);
        }
      },
      { root, threshold: [0.35, 0.55, 0.8] }
    );

    pageRefs.current.forEach((node) => {
      if (node) observer.observe(node);
    });

    return () => observer.disconnect();
  }, [pagePaths, readerMode]);

  useEffect(() => {
    if (!hasIpcBridge || pagePaths.length === 0) return;
    const timer = setTimeout(() => {
      void ipcInvoke('reader.saveProgress', {
        mangaId: manga.id,
        chapterIndex: 0,
        pageIndex: currentPageIndex,
        totalPages: pagePaths.length
      }).catch(() => undefined);
    }, 280);

    return () => clearTimeout(timer);
  }, [currentPageIndex, hasIpcBridge, manga.id, pagePaths.length]);

  const pageProgress = useMemo(() => {
    if (pagePaths.length === 0) {
      return '-- / --';
    }
    return `${Math.min(currentPageIndex + 1, pagePaths.length)} / ${pagePaths.length}`;
  }, [currentPageIndex, pagePaths.length]);

  const currentPagePath = pagePaths[currentPageIndex] ?? null;
  const canGoPrev = currentPageIndex - pageStep >= 0;
  const canGoNext = currentPageIndex + pageStep <= pagePaths.length - 1;
  const effectiveWidth = widthMode === 'fit' ? '100%' : `${fixedWidthPercent}%`;
  const widthLabel = widthMode === 'fit' ? '适应' : `${fixedWidthPercent}%`;

  const adjustFixedWidth = (deltaPercent: number) => {
    onWidthModeChange('fixed');
    onFixedWidthPercentChange(
      Math.min(MAX_FIXED_WIDTH_PERCENT, Math.max(MIN_FIXED_WIDTH_PERCENT, fixedWidthPercent + deltaPercent))
    );
  };

  const jumpToPage = useCallback(
    (nextPageIndex: number, behavior?: ScrollBehavior) => {
      if (pagePaths.length === 0) {
        return;
      }
      const next = Math.max(0, Math.min(nextPageIndex, maxPageIndex));
      setCurrentPageIndex(next);

      if (readerMode === 'scroll') {
        const targetNode = pageRefs.current[next];
        if (targetNode) {
          requestAnimationFrame(() => {
            targetNode.scrollIntoView({
              block: 'start',
              behavior: behavior ?? (pageAnimationEnabled ? 'smooth' : 'auto')
            });
          });
        }
      }
    },
    [maxPageIndex, pageAnimationEnabled, pagePaths.length, readerMode]
  );

  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    if (Number.isNaN(value)) {
      return;
    }
    jumpToPage(value - 1);
  };

  return (
    <main className="relative flex h-screen w-full min-w-0 flex-col bg-black">
      <header className="absolute inset-x-0 top-0 z-30 flex h-14 items-center border-b border-black/45 bg-[rgba(0,0,0,0.52)] px-4">
        <div className="flex min-w-0 items-center gap-3 pr-2">
          <button
            className="inline-flex h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-black/50 bg-[rgba(20,20,24,0.58)] px-3 text-xs font-semibold text-[#e3e5ea] transition hover:bg-[rgba(29,29,35,0.72)]"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{manga.title}</p>
            <p className="truncate text-[11px] text-[#7b8191]">{manga.folderPath}</p>
          </div>
        </div>
      </header>

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
            onMouseDown={handleReaderMouseDown}
            onContextMenu={handleReaderContextMenu}
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
                <img src={toPageSrc(pagePath)} alt={`${manga.title} - 第 ${index + 1} 页`} loading="lazy" className="w-full object-contain" />
              </div>
            ))}
          </div>
        ) : null}

        {!loading && !error && pagePaths.length > 0 && readerMode === 'paged' ? (
          <>
            <div
              className="flex min-h-0 flex-1 items-center justify-center px-4 py-5"
              onMouseDown={handleReaderMouseDown}
              onContextMenu={handleReaderContextMenu}
            >
              <div
                className="max-h-full max-w-full overflow-auto rounded-sm bg-[#0f0f12] shadow-[0_10px_28px_rgba(0,0,0,0.6)]"
                style={{ width: effectiveWidth }}
              >
                {currentPagePath ? (
                  <img
                    src={toPageSrc(currentPagePath)}
                    alt={`${manga.title} - 第 ${currentPageIndex + 1} 页`}
                    className="max-h-[calc(100vh-210px)] w-full object-contain"
                  />
                ) : null}
              </div>
            </div>
          </>
        ) : null}
      </div>

      {!loading && !error && pagePaths.length > 0 ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center px-4">
          <div className="pointer-events-auto flex w-full max-w-[760px] items-center gap-2 rounded-[18px] border border-black/45 bg-[rgba(0,0,0,0.72)] px-3 py-2.5 shadow-[0_18px_50px_rgba(0,0,0,0.42)]">
            <span className="min-w-[62px] text-xs font-semibold text-[#e7eaf0]">{pageProgress}</span>
            <input
              type="range"
              min={1}
              max={Math.max(pagePaths.length, 1)}
              value={Math.min(currentPageIndex + 1, Math.max(pagePaths.length, 1))}
              onChange={handleSliderChange}
              className="h-1.5 flex-1 cursor-pointer accent-[#2f6cf6]"
              aria-label="页面快速跳转"
            />

            <div className="mx-1 h-4 w-px bg-white/14" />

            <button
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#dce2ec] transition hover:bg-white/10 focus:outline-none focus-visible:outline-none disabled:opacity-40"
              onClick={() => movePage(-pageStep)}
              onMouseDown={handleToolbarButtonMouseDown}
              disabled={!canGoPrev}
              title="上一页"
            >
              ‹
            </button>
            <button
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#dce2ec] transition hover:bg-white/10 focus:outline-none focus-visible:outline-none disabled:opacity-40"
              onClick={() => movePage(pageStep)}
              onMouseDown={handleToolbarButtonMouseDown}
              disabled={!canGoNext}
              title="下一页"
            >
              ›
            </button>

            <div className="mx-1 h-4 w-px bg-white/14" />

            <div className="flex items-center gap-1 rounded-md bg-black/20 p-1">
              <button
                className={cn(
                  'rounded px-2 py-1 text-[11px] font-semibold transition focus:outline-none focus-visible:outline-none',
                  readerMode === 'paged' ? 'bg-[#2f6cf6] text-white' : 'text-[#dce2ec] hover:bg-white/10'
                )}
                onClick={() => onReaderModeChange('paged')}
                onMouseDown={handleToolbarButtonMouseDown}
                title="单页模式"
              >
                单
              </button>
              <button
                className={cn(
                  'rounded px-2 py-1 text-[11px] font-semibold transition focus:outline-none focus-visible:outline-none',
                  readerMode === 'scroll' ? 'bg-[#2f6cf6] text-white' : 'text-[#dce2ec] hover:bg-white/10'
                )}
                onClick={() => onReaderModeChange('scroll')}
                onMouseDown={handleToolbarButtonMouseDown}
                title="滚动模式"
              >
                滚
              </button>
            </div>

            <div className="flex items-center gap-1 rounded-md bg-black/20 p-1">
              <button
                className={cn(
                  'rounded px-2 py-1 text-[11px] font-semibold transition focus:outline-none focus-visible:outline-none',
                  widthMode === 'fit' ? 'bg-[#2f6cf6] text-white' : 'text-[#dce2ec] hover:bg-white/10'
                )}
                onClick={() => onWidthModeChange('fit')}
                onMouseDown={handleToolbarButtonMouseDown}
                title="适应宽度"
              >
                适
              </button>
              <button
                className={cn(
                  'rounded px-2 py-1 text-[11px] font-semibold transition focus:outline-none focus-visible:outline-none',
                  widthMode === 'fixed' ? 'bg-[#2f6cf6] text-white' : 'text-[#dce2ec] hover:bg-white/10'
                )}
                onClick={() => onWidthModeChange('fixed')}
                onMouseDown={handleToolbarButtonMouseDown}
                title="固定宽度"
              >
                固
              </button>

              <button
                className="inline-flex h-6 w-6 items-center justify-center rounded text-[#e3e5ea] transition hover:bg-white/10 focus:outline-none focus-visible:outline-none disabled:opacity-40"
                onClick={() => adjustFixedWidth(-5)}
                onMouseDown={handleToolbarButtonMouseDown}
                disabled={fixedWidthPercent <= MIN_FIXED_WIDTH_PERCENT}
                title="缩小宽度"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="min-w-[44px] text-center text-[11px] font-semibold text-[#e3e5ea]">{widthLabel}</span>
              <button
                className="inline-flex h-6 w-6 items-center justify-center rounded text-[#e3e5ea] transition hover:bg-white/10 focus:outline-none focus-visible:outline-none disabled:opacity-40"
                onClick={() => adjustFixedWidth(5)}
                onMouseDown={handleToolbarButtonMouseDown}
                disabled={fixedWidthPercent >= MAX_FIXED_WIDTH_PERCENT}
                title="增大宽度"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
