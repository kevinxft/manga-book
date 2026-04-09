import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MangaBookWithCover } from '@shared/types';
import { MangaPageEditorDialog } from '@renderer/components/manga/MangaPageEditorDialog';
import { ipcInvoke } from '@renderer/ipc/client';
import { DeleteMangaDialog } from '@renderer/pages/Organizer/components/DeleteMangaDialog';
import { useLibraryStore } from '@renderer/stores/libraryStore';
import { ReaderBoundarySuggestions } from './components/ReaderBoundarySuggestions';
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
  onOpenPreviousManga?: () => void;
  onOpenNextManga?: () => void;
  canOpenPreviousManga?: boolean;
  canOpenNextManga?: boolean;
  previousMangaCandidates?: MangaBookWithCover[];
  nextMangaCandidates?: MangaBookWithCover[];
  onOpenSuggestedManga?: (manga: MangaBookWithCover) => void;
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
  onBack,
  onOpenPreviousManga,
  onOpenNextManga,
  canOpenPreviousManga = false,
  canOpenNextManga = false,
  previousMangaCandidates = [],
  nextMangaCandidates = [],
  onOpenSuggestedManga
}: ReaderPageProps) {
  const hasIpcBridge = typeof window !== 'undefined' && typeof window.mangaBookApi?.invoke === 'function';
  const pageStep = 1;
  const [pageEditorOpen, setPageEditorOpen] = useState(false);
  const [pageEditorSelectedPaths, setPageEditorSelectedPaths] = useState<string[]>([]);
  const [pageEditorDeleting, setPageEditorDeleting] = useState(false);
  const [pageEditorError, setPageEditorError] = useState<string | null>(null);
  const [boundarySuggestionDirection, setBoundarySuggestionDirection] = useState<'prev' | 'next' | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingManga, setDeletingManga] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const updateMangaLocal = useLibraryStore((state) => state.updateMangaLocal);
  const removeMangaLocal = useLibraryStore((state) => state.removeMangaLocal);
  const fetchCoverPaths = useLibraryStore((state) => state.fetchCoverPaths);

  const { pagePaths, loading, error, currentPageIndex, setCurrentPageIndex, scrollContainerRef, pageRefs, reloadPages } =
    useReaderPages({
      manga,
      readerMode,
      hasIpcBridge
    });

  const maxPageIndex = Math.max(pagePaths.length - 1, 0);

  const scrollByViewport = useCallback(
    (delta: number, source: 'keyboard' | 'mouse' | 'ui'): boolean => {
      if (readerMode !== 'scroll') {
        return false;
      }

      const root = scrollContainerRef.current;
      if (!root) {
        return false;
      }

      const threshold = 8;
      const atEnd = root.scrollTop + root.clientHeight >= root.scrollHeight - threshold;
      const atStart = root.scrollTop <= threshold;

      if ((delta > 0 && atEnd) || (delta < 0 && atStart)) {
        if (source !== 'mouse') {
          setBoundarySuggestionDirection(delta > 0 ? 'next' : 'prev');
        }
        return true;
      }

      root.scrollBy({
        top: root.clientHeight * delta,
        behavior: pageAnimationEnabled ? 'smooth' : 'auto'
      });
      setBoundarySuggestionDirection(null);

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
    (delta: number, options?: { source?: 'keyboard' | 'mouse' | 'ui' }) => {
      if (pagePaths.length === 0) {
        return;
      }

      const source = options?.source ?? 'ui';

      if (scrollByViewport(delta, source)) {
        return;
      }

      const nextIndex = Math.max(0, Math.min(currentPageIndex + delta, maxPageIndex));
      if (nextIndex !== currentPageIndex) {
        setCurrentPageIndex(nextIndex);
        scrollToPage(nextIndex);
        setBoundarySuggestionDirection(null);
        return;
      }

      if (source !== 'mouse') {
        setBoundarySuggestionDirection(delta > 0 ? 'next' : 'prev');
      }
    },
    [currentPageIndex, maxPageIndex, pagePaths.length, scrollByViewport, scrollToPage, setCurrentPageIndex]
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
    onWidthModeChange,
    interactionsDisabled: pageEditorOpen
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
    setBoundarySuggestionDirection(null);
    jumpToPage(value - 1);
  };

  const handleOpenPageEditor = useCallback(() => {
    setPageEditorSelectedPaths([]);
    setPageEditorError(null);
    setBoundarySuggestionDirection(null);
    setPageEditorOpen(true);
  }, []);

  const handleRequestDeleteManga = useCallback(() => {
    setDeleteError(null);
    setDeleteDialogOpen(true);
  }, []);

  const handleCloseDeleteDialog = useCallback(() => {
    if (deletingManga) {
      return;
    }
    setDeleteDialogOpen(false);
    setDeleteError(null);
  }, [deletingManga]);

  const handleClosePageEditor = useCallback(() => {
    if (pageEditorDeleting) {
      return;
    }
    setPageEditorOpen(false);
    setPageEditorSelectedPaths([]);
    setPageEditorError(null);
  }, [pageEditorDeleting]);

  const handleTogglePageSelection = useCallback((pagePath: string) => {
    setPageEditorSelectedPaths((current) =>
      current.includes(pagePath) ? current.filter((item) => item !== pagePath) : [...current, pagePath]
    );
  }, []);

  const handleDeleteSelectedPages = useCallback(async () => {
    if (pageEditorSelectedPaths.length === 0) {
      return;
    }

    if (pageEditorSelectedPaths.length >= pagePaths.length) {
      setPageEditorError('至少需要保留 1 页漫画。');
      return;
    }

    setPageEditorDeleting(true);
    setPageEditorError(null);
    const selectedPageSet = new Set(pageEditorSelectedPaths);

    try {
      const remainingPagePaths = pagePaths.filter((pagePath) => !selectedPageSet.has(pagePath));
      const currentPagePath = pagePaths[currentPageIndex] ?? null;
      const preferredPagePath =
        currentPagePath && !selectedPageSet.has(currentPagePath)
          ? currentPagePath
          : remainingPagePaths[Math.min(currentPageIndex, Math.max(remainingPagePaths.length - 1, 0))];
      const fallbackPageIndex = preferredPagePath
        ? Math.max(remainingPagePaths.indexOf(preferredPagePath), 0)
        : Math.min(currentPageIndex, Math.max(remainingPagePaths.length - 1, 0));
      const result = await ipcInvoke('reader.deletePages', {
        mangaId: manga.id,
        pagePaths: pageEditorSelectedPaths
      });

      await reloadPages({
        preferredPagePath,
        fallbackPageIndex
      });

      updateMangaLocal(manga.id, (current) => ({
        ...current,
        totalPages: result.totalPages,
        lastPageIndex: fallbackPageIndex,
        coverPath: current.coverPath && selectedPageSet.has(current.coverPath) ? null : current.coverPath
      }));
      await fetchCoverPaths([manga.folderPath], { force: true });
      setPageEditorSelectedPaths([]);
    } catch (deleteError) {
      setPageEditorError(deleteError instanceof Error ? deleteError.message : '删除漫画页面失败');
    } finally {
      setPageEditorDeleting(false);
    }
  }, [currentPageIndex, fetchCoverPaths, manga.folderPath, manga.id, pageEditorSelectedPaths, pagePaths, reloadPages, updateMangaLocal]);

  const handleConfirmDeleteManga = useCallback(async () => {
    if (deletingManga) {
      return;
    }

    setDeletingManga(true);
    setDeleteError(null);
    try {
      await ipcInvoke('organizer.deleteManga', { mangaId: manga.id, withFiles: true });
      removeMangaLocal(manga.id);
      setDeleteDialogOpen(false);
      onBack();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : '删除漫画失败');
    } finally {
      setDeletingManga(false);
    }
  }, [deletingManga, manga.id, onBack, removeMangaLocal]);

  useEffect(() => {
    setBoundarySuggestionDirection(null);
    setPageEditorOpen(false);
    setPageEditorSelectedPaths([]);
    setPageEditorError(null);
    setDeleteDialogOpen(false);
    setDeleteError(null);
  }, [manga.id]);

  const boundarySuggestionMangas = boundarySuggestionDirection === 'next' ? nextMangaCandidates : previousMangaCandidates;

  useEffect(() => {
    if (!boundarySuggestionDirection || boundarySuggestionMangas.length === 0) {
      return;
    }

    void fetchCoverPaths(boundarySuggestionMangas.map((item) => item.folderPath));
  }, [boundarySuggestionDirection, boundarySuggestionMangas, fetchCoverPaths]);

  return (
    <main className="relative flex h-screen w-full min-w-0 flex-col bg-black">
      <ReaderTopBar
        title={manga.title}
        folderPath={manga.folderPath}
        onBack={onBack}
        onOpenPreviousManga={onOpenPreviousManga}
        onOpenNextManga={onOpenNextManga}
        canOpenPreviousManga={canOpenPreviousManga}
        canOpenNextManga={canOpenNextManga}
        onDeleteManga={handleRequestDeleteManga}
        deleting={deletingManga}
      />

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

      {boundarySuggestionDirection && boundarySuggestionMangas.length > 0 ? (
        <ReaderBoundarySuggestions
          direction={boundarySuggestionDirection}
          mangas={boundarySuggestionMangas}
          onSelect={(targetManga) => {
            setBoundarySuggestionDirection(null);
            onOpenSuggestedManga?.(targetManga);
          }}
        />
      ) : null}

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
          onOpenPageEditor={handleOpenPageEditor}
          onPrev={() => movePage(-pageStep, { source: 'ui' })}
          onNext={() => movePage(pageStep, { source: 'ui' })}
          onReaderModeChange={onReaderModeChange}
          onWidthModeChange={onWidthModeChange}
          onAdjustWidth={adjustFixedWidth}
          onToolbarButtonMouseDown={handleToolbarButtonMouseDown}
        />
      ) : null}

      <MangaPageEditorDialog
        open={pageEditorOpen}
        title={manga.title}
        pagePaths={pagePaths}
        selectedPagePaths={pageEditorSelectedPaths}
        loading={loading}
        deleting={pageEditorDeleting}
        error={pageEditorError}
        onClose={handleClosePageEditor}
        onTogglePage={handleTogglePageSelection}
        onDeleteSelected={() => void handleDeleteSelectedPages()}
        onClearSelection={() => setPageEditorSelectedPaths([])}
      />

      <DeleteMangaDialog
        open={deleteDialogOpen}
        target={manga}
        deleting={deletingManga}
        error={deleteError}
        onClose={handleCloseDeleteDialog}
        onConfirm={() => void handleConfirmDeleteManga()}
      />
    </main>
  );
}
