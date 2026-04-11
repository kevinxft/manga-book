import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MangaBookWithCover, ReaderChapter } from '@shared/types';
import { X } from 'lucide-react';
import { AddTagPopover } from '@renderer/components/manga/AddTagPopover';
import { MangaPageEditorDialog } from '@renderer/components/manga/MangaPageEditorDialog';
import { useMangaTagEditor } from '@renderer/hooks/manga/useMangaTagEditor';
import { ipcInvoke } from '@renderer/ipc/client';
import { DeleteMangaDialog } from '@renderer/pages/Organizer/components/DeleteMangaDialog';
import { useLibraryStore } from '@renderer/stores/libraryStore';
import { useOrganizerMetadataStore } from '@renderer/stores/organizerMetadataStore';
import { ReaderChapterPanel } from './components/ReaderChapterPanel';
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

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+$/, '');
}

function isMangaInsideAuthorDirectory(folderPath: string, authorDirectoryPaths: string[]): boolean {
  const normalizedFolderPath = normalizePath(folderPath);

  return authorDirectoryPaths.some((directoryPath) => {
    const normalizedDirectoryPath = normalizePath(directoryPath);
    return normalizedFolderPath.startsWith(`${normalizedDirectoryPath}/`);
  });
}

function resolveCurrentChapterIndex(chapters: ReaderChapter[], currentPageIndex: number): number {
  if (chapters.length === 0) {
    return 0;
  }

  for (let index = chapters.length - 1; index >= 0; index -= 1) {
    const chapter = chapters[index];
    if (chapter && currentPageIndex >= chapter.startPageIndex) {
      return index;
    }
  }

  return 0;
}

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
  const [pageEditorDeleting, setPageEditorDeleting] = useState(false);
  const [pageEditorError, setPageEditorError] = useState<string | null>(null);
  const [boundarySuggestionDirection, setBoundarySuggestionDirection] = useState<'prev' | 'next' | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingManga, setDeletingManga] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [chapters, setChapters] = useState<ReaderChapter[]>([]);
  const [chapterBusy, setChapterBusy] = useState(false);
  const updateMangaLocal = useLibraryStore((state) => state.updateMangaLocal);
  const removeMangaLocal = useLibraryStore((state) => state.removeMangaLocal);
  const fetchCoverPaths = useLibraryStore((state) => state.fetchCoverPaths);
  const authorDirectories = useOrganizerMetadataStore((state) => state.authorDirectories);
  const ensureOrganizerMetadataLoaded = useOrganizerMetadataStore((state) => state.ensureLoaded);

  const { pagePaths, loading, error, currentPageIndex, setCurrentPageIndex, scrollContainerRef, pageRefs, reloadPages } =
    useReaderPages({
      manga,
      readerMode,
      hasIpcBridge
    });

  useEffect(() => {
    if (!hasIpcBridge) {
      return;
    }

    void ensureOrganizerMetadataLoaded();
  }, [ensureOrganizerMetadataLoaded, hasIpcBridge]);

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

      const threshold = 8;
      const atEnd = root.scrollTop + root.clientHeight >= root.scrollHeight - threshold;
      const atStart = root.scrollTop <= threshold;

      if ((delta > 0 && atEnd) || (delta < 0 && atStart)) {
        setBoundarySuggestionDirection(delta > 0 ? 'next' : 'prev');
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
    (delta: number) => {
      if (pagePaths.length === 0) {
        return;
      }

      if (scrollByViewport(delta)) {
        return;
      }

      const nextIndex = Math.max(0, Math.min(currentPageIndex + delta, maxPageIndex));
      if (nextIndex !== currentPageIndex) {
        setCurrentPageIndex(nextIndex);
        scrollToPage(nextIndex);
        setBoundarySuggestionDirection(null);
        return;
      }

      setBoundarySuggestionDirection(delta > 0 ? 'next' : 'prev');
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

  const {
    addTagDialogOpen,
    addTagTarget,
    addTagAnchor,
    addTagSaving,
    addTagError,
    availableTagNames,
    openAddTagDialog,
    closeAddTagDialog,
    handleConfirmAddTag
  } = useMangaTagEditor({
    hasIpcBridge,
    updateMangaLocal,
    setError: setActionError
  });
  const { handleReaderMouseDown, handleReaderContextMenu, handleToolbarButtonMouseDown } = useReaderControls({
    pageStep,
    movePage,
    onBack,
    readerMode,
    widthMode,
    onWidthModeChange,
    interactionsDisabled: pageEditorOpen || addTagDialogOpen
  });

  const pageProgress = useMemo(() => {
    if (pagePaths.length === 0) {
      return '-- / --';
    }
    return `${Math.min(currentPageIndex + 1, pagePaths.length)} / ${pagePaths.length}`;
  }, [currentPageIndex, pagePaths.length]);
  const currentChapterIndex = useMemo(
    () => resolveCurrentChapterIndex(chapters, currentPageIndex),
    [chapters, currentPageIndex]
  );
  const isAuthorDirectoryManga = isMangaInsideAuthorDirectory(
    manga.folderPath,
    authorDirectories.map((item) => item.directory)
  );
  const canEditChapterMetadata = isAuthorDirectoryManga && chapters.length > 0;
  const canAddChapter =
    manga.structure === 'singleVolume' &&
    pagePaths.length > 0 &&
    isAuthorDirectoryManga;
  const canAddAtCurrentPage =
    canAddChapter &&
    currentPageIndex > 0 &&
    !chapters.some((chapter) => chapter.startPageIndex === currentPageIndex);
  const showChapterPanel = !loading && !error && (chapters.length > 0 || canAddChapter);

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
    closeAddTagDialog();
    setPageEditorError(null);
    setActionError(null);
    setBoundarySuggestionDirection(null);
    setPageEditorOpen(true);
  }, [closeAddTagDialog]);

  const handleOpenTagEditor = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setActionError(null);
    setBoundarySuggestionDirection(null);
    openAddTagDialog(manga, {
      x: rect.left + rect.width / 2,
      y: rect.bottom
    });
  }, [manga, openAddTagDialog]);

  const handleRequestDeleteManga = useCallback(() => {
    closeAddTagDialog();
    setDeleteError(null);
    setDeleteDialogOpen(true);
  }, [closeAddTagDialog]);

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
    setPageEditorError(null);
  }, [pageEditorDeleting]);

  const reloadChapters = useCallback(async () => {
    if (!hasIpcBridge) {
      setChapters([]);
      return;
    }

    try {
      const nextChapters = await ipcInvoke('reader.listChapters', { mangaId: manga.id });
      setChapters(nextChapters);
    } catch (chapterError) {
      setActionError(chapterError instanceof Error ? chapterError.message : '加载章节失败');
      setChapters([]);
    }
  }, [hasIpcBridge, manga.id]);

  const handleAddChapter = useCallback(async () => {
    if (!canAddAtCurrentPage || chapterBusy) {
      return;
    }

    setChapterBusy(true);
    setActionError(null);
    try {
      const nextChapters = await ipcInvoke('reader.addChapter', {
        mangaId: manga.id,
        pageIndex: currentPageIndex
      });
      setChapters(nextChapters);
    } catch (chapterError) {
      setActionError(chapterError instanceof Error ? chapterError.message : '新增章节失败');
    } finally {
      setChapterBusy(false);
    }
  }, [canAddAtCurrentPage, chapterBusy, currentPageIndex, manga.id]);

  const handleRemoveChapter = useCallback(async (chapter: ReaderChapter) => {
    if (!chapter.deletable || chapterBusy) {
      return;
    }

    setChapterBusy(true);
    setActionError(null);
    try {
      const nextChapters = await ipcInvoke('reader.removeChapter', {
        mangaId: manga.id,
        chapterId: chapter.id
      });
      setChapters(nextChapters);
    } catch (chapterError) {
      setActionError(chapterError instanceof Error ? chapterError.message : '删除章节失败');
    } finally {
      setChapterBusy(false);
    }
  }, [chapterBusy, manga.id]);

  const handleUpdateChapter = useCallback(async (chapter: ReaderChapter, input: { title?: string | null; highlighted?: boolean }) => {
    if (chapterBusy || !isAuthorDirectoryManga) {
      return;
    }

    setChapterBusy(true);
    setActionError(null);
    try {
      const nextChapters = await ipcInvoke('reader.updateChapter', {
        mangaId: manga.id,
        chapterId: chapter.id,
        title: input.title,
        highlighted: input.highlighted
      });
      setChapters(nextChapters);
    } catch (chapterError) {
      setActionError(chapterError instanceof Error ? chapterError.message : '更新章节失败');
    } finally {
      setChapterBusy(false);
    }
  }, [chapterBusy, isAuthorDirectoryManga, manga.id]);

  const handleDeleteSelectedPages = useCallback(async (selectedPagePaths: string[]) => {
    if (selectedPagePaths.length === 0) {
      return;
    }

    if (selectedPagePaths.length >= pagePaths.length) {
      setPageEditorError('至少需要保留 1 页漫画。');
      return;
    }

    setPageEditorDeleting(true);
    setPageEditorError(null);
    const selectedPageSet = new Set(selectedPagePaths);

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
        pagePaths: selectedPagePaths
      });

      await reloadPages({
        preferredPagePath,
        fallbackPageIndex,
        silent: true
      });
      await reloadChapters();

      updateMangaLocal(manga.id, (current) => ({
        ...current,
        totalPages: result.totalPages,
        lastPageIndex: fallbackPageIndex,
        coverPath: current.coverPath && selectedPageSet.has(current.coverPath) ? null : current.coverPath
      }));
      await fetchCoverPaths([manga.folderPath], { force: true });
    } catch (deleteError) {
      setPageEditorError(deleteError instanceof Error ? deleteError.message : '删除漫画页面失败');
    } finally {
      setPageEditorDeleting(false);
    }
  }, [currentPageIndex, fetchCoverPaths, manga.folderPath, manga.id, pagePaths, reloadChapters, reloadPages, updateMangaLocal]);

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
    setPageEditorError(null);
    setDeleteDialogOpen(false);
    setDeleteError(null);
    setActionError(null);
    setChapters([]);
    closeAddTagDialog(true);
  }, [closeAddTagDialog, manga.id]);

  const boundarySuggestionMangas = boundarySuggestionDirection === 'next' ? nextMangaCandidates : previousMangaCandidates;

  useEffect(() => {
    if (!boundarySuggestionDirection || boundarySuggestionMangas.length === 0) {
      return;
    }

    void fetchCoverPaths(boundarySuggestionMangas.map((item) => item.folderPath));
  }, [boundarySuggestionDirection, boundarySuggestionMangas, fetchCoverPaths]);

  useEffect(() => {
    void reloadChapters();
  }, [reloadChapters, pagePaths.length]);

  useEffect(() => {
    if (!hasIpcBridge || pagePaths.length === 0) {
      return;
    }

    const timer = setTimeout(() => {
      void ipcInvoke('reader.saveProgress', {
        mangaId: manga.id,
        chapterIndex: currentChapterIndex,
        pageIndex: currentPageIndex,
        totalPages: pagePaths.length
      }).catch(() => undefined);
    }, 280);

    return () => clearTimeout(timer);
  }, [currentChapterIndex, currentPageIndex, hasIpcBridge, manga.id, pagePaths.length]);

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
        onOpenTagEditor={handleOpenTagEditor}
        onOpenPageEditor={handleOpenPageEditor}
        onDeleteManga={handleRequestDeleteManga}
        deleting={deletingManga}
      />

      {actionError ? (
        <div className="pointer-events-auto absolute left-1/2 top-20 z-30 flex w-[min(560px,calc(100%-32px))] -translate-x-1/2 items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/12 px-3 py-2 text-sm text-red-100 shadow-[0_12px_30px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          <span className="min-w-0 flex-1 break-words">{actionError}</span>
          <button
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-red-200 transition hover:bg-red-500/20 hover:text-white"
            onClick={() => setActionError(null)}
            title="关闭错误提示"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      <ReaderChapterPanel
        mangaId={manga.id}
        visible={showChapterPanel}
        chapters={chapters}
        currentChapterIndex={currentChapterIndex}
        chapterBusy={chapterBusy}
        canAddChapter={canAddChapter}
        canEditChapterMetadata={canEditChapterMetadata}
        canAddAtCurrentPage={canAddAtCurrentPage}
        currentPageIndex={currentPageIndex}
        onAddChapter={() => void handleAddChapter()}
        onJumpToChapter={(chapter) => jumpToPage(chapter.startPageIndex)}
        onRemoveChapter={(chapter) => void handleRemoveChapter(chapter)}
        onUpdateChapter={(chapter, input) => void handleUpdateChapter(chapter, input)}
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
          pageProgress={chapters.length > 0 ? `${currentChapterIndex + 1} · ${pageProgress}` : pageProgress}
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
          onPrev={() => movePage(-pageStep)}
          onNext={() => movePage(pageStep)}
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
        loading={loading}
        deleting={pageEditorDeleting}
        error={pageEditorError}
        onClose={handleClosePageEditor}
        onDeleteSelected={handleDeleteSelectedPages}
      />

      <DeleteMangaDialog
        open={deleteDialogOpen}
        target={manga}
        deleting={deletingManga}
        error={deleteError}
        onClose={handleCloseDeleteDialog}
        onConfirm={() => void handleConfirmDeleteManga()}
      />

      <AddTagPopover
        open={addTagDialogOpen}
        anchor={addTagAnchor}
        mangaId={addTagTarget?.id ?? null}
        mangaTitle={addTagTarget?.title ?? null}
        initialTags={addTagTarget?.tags.map((tag) => tag.name) ?? []}
        availableTags={availableTagNames}
        saving={addTagSaving}
        error={addTagError}
        onClose={() => closeAddTagDialog()}
        onSubmit={(values) => void handleConfirmAddTag(values)}
      />
    </main>
  );
}
