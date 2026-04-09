import { useCallback, useMemo } from 'react';
import type { MangaBookWithCover } from '@shared/types';
import { ReaderBottomBar } from './components/ReaderBottomBar';
import { ReaderTopBar } from './components/ReaderTopBar';
import { ReaderViewport } from './components/ReaderViewport';
import { useReaderControls } from './hooks/useReaderControls';
import { useReaderPages } from './hooks/useReaderPages';
import type { ReaderMode, ReaderWidthMode } from './types';

export type { ReaderMode, ReaderWidthMode } from './types';

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
  const hasIpcBridge = typeof window !== 'undefined' && typeof window.mangaBookApi?.invoke === 'function';
  const pageStep = 1;

  const { pagePaths, loading, error, currentPageIndex, setCurrentPageIndex, scrollContainerRef, pageRefs } =
    useReaderPages({
      manga,
      readerMode,
      hasIpcBridge
    });

  const maxPageIndex = Math.max(pagePaths.length - 1, 0);

  const scrollByViewport = useCallback(
    (delta: number): boolean => {
      if (readerMode !== 'scroll') {
        return false;
      }

      const root = scrollContainerRef.current;
      if (!root) {
        return false;
      }

      root.scrollBy({
        top: root.clientHeight * delta,
        behavior: pageAnimationEnabled ? 'smooth' : 'auto'
      });

      return true;
    },
    [pageAnimationEnabled, readerMode, scrollContainerRef]
  );

  const scrollToPage = useCallback(
    (index: number, behavior?: ScrollBehavior) => {
      if (readerMode !== 'scroll') {
        return;
      }

      const targetNode = pageRefs.current[index];
      if (!targetNode) {
        return;
      }

      requestAnimationFrame(() => {
        targetNode.scrollIntoView({
          block: 'start',
          behavior: behavior ?? (pageAnimationEnabled ? 'smooth' : 'auto')
        });
      });
    },
    [pageAnimationEnabled, pageRefs, readerMode]
  );

  const movePage = useCallback(
    (delta: number) => {
      if (pagePaths.length === 0) {
        return;
      }

      if (scrollByViewport(delta)) {
        return;
      }

      setCurrentPageIndex((prev) => {
        const next = Math.max(0, Math.min(prev + delta, maxPageIndex));
        if (next !== prev) {
          scrollToPage(next);
        }
        return next;
      });
    },
    [maxPageIndex, pagePaths.length, scrollByViewport, scrollToPage, setCurrentPageIndex]
  );

  const jumpToPage = useCallback(
    (nextPageIndex: number) => {
      if (pagePaths.length === 0) {
        return;
      }

      const next = Math.max(0, Math.min(nextPageIndex, maxPageIndex));
      setCurrentPageIndex(next);
      scrollToPage(next);
    },
    [maxPageIndex, pagePaths.length, scrollToPage, setCurrentPageIndex]
  );

  const { handleReaderMouseDown, handleReaderContextMenu, handleToolbarButtonMouseDown } = useReaderControls({
    pageStep,
    movePage,
    onBack,
    readerMode,
    widthMode,
    onWidthModeChange
  });

  const pageProgress = useMemo(() => {
    if (pagePaths.length === 0) {
      return '-- / --';
    }
    return `${Math.min(currentPageIndex + 1, pagePaths.length)} / ${pagePaths.length}`;
  }, [currentPageIndex, pagePaths.length]);

  const canGoPrev = currentPageIndex - pageStep >= 0;
  const canGoNext = currentPageIndex + pageStep <= pagePaths.length - 1;
  const effectiveWidth = widthMode === 'fit' ? '100%' : `${fixedWidthPercent}%`;
  const widthLabel = widthMode === 'fit' ? '适应' : `${fixedWidthPercent}%`;

  const adjustFixedWidth = useCallback(
    (deltaPercent: number) => {
      onWidthModeChange('fixed');
      onFixedWidthPercentChange(
        Math.min(MAX_FIXED_WIDTH_PERCENT, Math.max(MIN_FIXED_WIDTH_PERCENT, fixedWidthPercent + deltaPercent))
      );
    },
    [fixedWidthPercent, onFixedWidthPercentChange, onWidthModeChange]
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
      <ReaderTopBar title={manga.title} folderPath={manga.folderPath} onBack={onBack} />

      <ReaderViewport
        readerMode={readerMode}
        loading={loading}
        error={error}
        pagePaths={pagePaths}
        currentPageIndex={currentPageIndex}
        effectiveWidth={effectiveWidth}
        mangaTitle={manga.title}
        scrollContainerRef={scrollContainerRef}
        pageRefs={pageRefs}
        onReaderMouseDown={handleReaderMouseDown}
        onReaderContextMenu={handleReaderContextMenu}
      />

      {!loading && !error && pagePaths.length > 0 ? (
        <ReaderBottomBar
          pageProgress={pageProgress}
          pageCount={pagePaths.length}
          currentPageIndex={currentPageIndex}
          canGoPrev={canGoPrev}
          canGoNext={canGoNext}
          readerMode={readerMode}
          widthMode={widthMode}
          widthLabel={widthLabel}
          canDecreaseWidth={fixedWidthPercent > MIN_FIXED_WIDTH_PERCENT}
          canIncreaseWidth={fixedWidthPercent < MAX_FIXED_WIDTH_PERCENT}
          onSliderChange={handleSliderChange}
          onBack={onBack}
          onPrev={() => movePage(-pageStep)}
          onNext={() => movePage(pageStep)}
          onReaderModeChange={onReaderModeChange}
          onWidthModeChange={onWidthModeChange}
          onAdjustWidth={adjustFixedWidth}
          onToolbarButtonMouseDown={handleToolbarButtonMouseDown}
        />
      ) : null}
    </main>
  );
}
