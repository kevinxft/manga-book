import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { MangaBookWithCover } from '@shared/types';
import { cn } from '@renderer/lib/utils';
import { useLibraryStore } from '@renderer/stores/libraryStore';
import { LibraryHeader } from './components/LibraryHeader';
import { LibraryScanOverlay } from './components/LibraryScanOverlay';
import { LibrarySidebar } from './components/LibrarySidebar';
import { MangaGrid } from './components/MangaGrid';
import { TagManagementDialog } from './components/TagManagementDialog';
import { DeleteMangaDialog } from '@renderer/pages/Organizer/components/DeleteMangaDialog';
import { useMangaTagEditor } from '@renderer/hooks/manga/useMangaTagEditor';
import { useTagEditor } from './hooks/useTagEditor';
import { AddTagPopover } from '@renderer/components/manga/AddTagPopover';
import { useLibraryFilters } from './hooks/useLibraryFilters';
import { useLibraryMangaActions } from './hooks/useLibraryMangaActions';
import { useLibraryOrganizerCategories } from './hooks/useLibraryOrganizerCategories';
import { useLibraryDataLifecycle } from './hooks/useLibraryDataLifecycle';

interface LibraryPageProps {
  onOpenManga?: (manga: MangaBookWithCover) => void;
  onOpenSettings?: () => void;
  onOpenOrganizer?: () => void;
}

const LIBRARY_SIDEBAR_DEFAULT_WIDTH = 270;
const LIBRARY_SIDEBAR_MIN_WIDTH = 220;
const LIBRARY_SIDEBAR_MAX_WIDTH = 420;
const LIBRARY_SIDEBAR_COLLAPSED_WIDTH = 72;
const LIBRARY_SIDEBAR_RESIZER_WIDTH = 8;
const LIBRARY_SIDEBAR_STORAGE_KEY = 'manga-book.library-sidebar-width';
const LIBRARY_MAIN_CONTENT_MIN_WIDTH = 480;

function readStoredSidebarWidth(): number | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(LIBRARY_SIDEBAR_STORAGE_KEY);
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function clampSidebarWidth(width: number, containerWidth?: number): number {
  const containerMaxWidth =
    typeof containerWidth === 'number'
      ? Math.max(LIBRARY_SIDEBAR_MIN_WIDTH, containerWidth - LIBRARY_MAIN_CONTENT_MIN_WIDTH)
      : LIBRARY_SIDEBAR_MAX_WIDTH;
  return Math.min(Math.max(width, LIBRARY_SIDEBAR_MIN_WIDTH), Math.min(LIBRARY_SIDEBAR_MAX_WIDTH, containerMaxWidth));
}

export function LibraryPage({ onOpenManga, onOpenSettings, onOpenOrganizer }: LibraryPageProps) {
  const hasIpcBridge = typeof window !== 'undefined' && typeof window.mangaBookApi?.invoke === 'function';
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(() => clampSidebarWidth(readStoredSidebarWidth() ?? LIBRARY_SIDEBAR_DEFAULT_WIDTH));
  const [sidebarWidthHydrated, setSidebarWidthHydrated] = useState(false);

  const {
    tags,
    selectedTags,
    tagDialogOpen,
    newTagLabel,
    openTagDialog,
    closeTagDialog,
    toggleTagSelection,
    clearSelectedTags,
    setNewTagLabel,
    upsertDraftTag,
    removeDraftTag: removeGlobalTag,
    clearAllTags
  } = useTagEditor(hasIpcBridge);

  const {
    sources,
    mangas,
    loading,
    error,
    progress,
    fetchSources,
    fetchMangas,
    pickAndAddSources,
    removeSource,
    syncSources,
    refreshScanProgress,
    updateMangaLocal,
    removeMangaLocal
  } = useLibraryStore();

  const { artistDirectories, quickMoveCategories } = useLibraryOrganizerCategories({
    hasIpcBridge,
    mangas
  });

  const {
    search,
    sortBy,
    activeMenu,
    sidebarCollapsed,
    visibleMangas,
    sourceMangaCountByPath,
    setSearch,
    setSortBy,
    setActiveMenu,
    setSidebarCollapsed
  } = useLibraryFilters({
    mangas,
    artistDirectories,
    selectedTags
  });

  const { scanRunning } = useLibraryDataLifecycle({
    hasIpcBridge,
    search,
    sortBy,
    fetchSources,
    fetchMangas,
    refreshScanProgress,
    progress
  });

  const {
    operationError,
    setOperationError,
    handleQuickMoveManga,
    handleRenameManga,
    handleOpenInFolder,
    handleSearchWeb,
    deleteDialogOpen,
    deleteTarget,
    deleting,
    handleRequestDeleteManga,
    closeDeleteDialog,
    handleConfirmDeleteManga
  } = useLibraryMangaActions({
    hasIpcBridge,
    updateMangaLocal,
    removeMangaLocal
  });

  const {
    addTagDialogOpen,
    addTagTarget,
    addTagAnchor,
    addTagInput,
    addTagDraft,
    addTagSaving,
    addTagError,
    setAddTagInput,
    openAddTagDialog,
    closeAddTagDialog,
    appendDraftTag,
    removeDraftTag,
    appendInputTag,
    handleConfirmAddTag
  } = useMangaTagEditor({
    hasIpcBridge,
    updateMangaLocal,
    setError: setOperationError
  });

  const handleSidebarCollapsedChange = useCallback((value: boolean) => {
    setSidebarCollapsed(value);
  }, [setSidebarCollapsed]);

  useEffect(() => {
    const storedWidth = readStoredSidebarWidth();
    if (storedWidth !== null) {
      setSidebarWidth((current) => {
        const containerWidth = containerRef.current?.getBoundingClientRect().width;
        const nextWidth = clampSidebarWidth(storedWidth, containerWidth);
        return nextWidth === current ? current : nextWidth;
      });
    }
    setSidebarWidthHydrated(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !sidebarWidthHydrated) {
      return;
    }
    window.localStorage.setItem(LIBRARY_SIDEBAR_STORAGE_KEY, String(sidebarWidth));
  }, [sidebarWidth, sidebarWidthHydrated]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) {
        return;
      }
      if (entry.contentRect.width <= 0) {
        return;
      }
      const nextWidth = clampSidebarWidth(sidebarWidth, entry.contentRect.width);
      if (nextWidth !== sidebarWidth) {
        setSidebarWidth(nextWidth);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [sidebarWidth]);

  const handleSidebarResizeStart = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (sidebarCollapsed) {
      return;
    }

    event.preventDefault();
    const container = containerRef.current;
    const startX = event.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const containerWidth = container?.getBoundingClientRect().width;
      const delta = moveEvent.clientX - startX;
      setSidebarWidth(clampSidebarWidth(startWidth + delta, containerWidth));
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [sidebarCollapsed, sidebarWidth]);

  const libraryLayoutStyle = useMemo(
    () => ({
      gridTemplateColumns: sidebarCollapsed
        ? `${LIBRARY_SIDEBAR_COLLAPSED_WIDTH}px 1fr`
        : `${sidebarWidth}px ${LIBRARY_SIDEBAR_RESIZER_WIDTH}px 1fr`
    }),
    [sidebarCollapsed, sidebarWidth]
  );

  return (
    <main className="h-full w-full bg-[#eceef2] p-1">
      <div ref={containerRef} className="h-full overflow-hidden rounded-[8px] border border-[#d8dee9] bg-[#f1f2f5]">
        <div className="grid h-full overflow-hidden transition-[grid-template-columns] duration-200" style={libraryLayoutStyle}>
          <LibrarySidebar
            sidebarCollapsed={sidebarCollapsed}
            activeMenu={activeMenu}
            artistDirectories={artistDirectories}
            tags={tags}
            selectedTags={selectedTags}
            sources={sources}
            sourceMangaCountByPath={sourceMangaCountByPath}
            hasIpcBridge={hasIpcBridge}
            scanRunning={scanRunning}
            onActiveMenuChange={setActiveMenu}
            onToggleTag={toggleTagSelection}
            onClearSelectedTags={clearSelectedTags}
            onOpenTagDialog={openTagDialog}
            onPickAndAddSources={() => void pickAndAddSources()}
            onSyncSource={(sourcePath) => void syncSources([sourcePath])}
            onRemoveSource={(sourceId) => {
              void removeSource(sourceId);
            }}
            onOpenSettings={onOpenSettings}
            onOpenOrganizer={onOpenOrganizer}
          />

          {!sidebarCollapsed ? (
            <div
              className="group relative h-full cursor-col-resize bg-transparent"
              onMouseDown={handleSidebarResizeStart}
              role="separator"
              aria-orientation="vertical"
              aria-label="调整侧边栏宽度"
            >
              <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[#d7deea] transition group-hover:bg-[#2f6cf6]" />
              <div className="absolute inset-y-0 left-1/2 w-2 -translate-x-1/2" />
            </div>
          ) : null}

          <section className="relative flex min-h-0 flex-col bg-[#f3f5f9]">
            <LibraryHeader
              sidebarCollapsed={sidebarCollapsed}
              sortBy={sortBy}
              loading={loading}
              mangaCount={visibleMangas.length}
              hasIpcBridge={hasIpcBridge}
              scanRunning={scanRunning}
              search={search}
              onSidebarCollapsedChange={handleSidebarCollapsedChange}
              onSortByChange={setSortBy}
              onSearchChange={setSearch}
              onSyncSources={() => void syncSources()}
            />

            {!hasIpcBridge ? (
              <div className="mx-6 mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                当前运行在普通浏览器环境，IPC 不可用。请使用 <code>bun run dev</code> 启动 Electron 窗口。
              </div>
            ) : null}

            <LibraryScanOverlay progress={progress} />

            {error ? (
              <div className="mx-6 mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            ) : null}

            {operationError ? (
              <div className="mx-6 mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <span className="min-w-0 flex-1 break-words">{operationError}</span>
                <button
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-red-500 transition hover:bg-red-100 hover:text-red-700"
                  onClick={() => setOperationError(null)}
                  title="关闭错误提示"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}

            <MangaGrid
              mangas={visibleMangas}
              totalMangaCount={mangas.length}
              loading={loading}
              quickMoveCategories={quickMoveCategories}
              onQuickMoveManga={(mangaId, destinationPath) => void handleQuickMoveManga(mangaId, destinationPath)}
              onAddTagManga={(item, anchor) => openAddTagDialog(item, anchor)}
              onRenameManga={(item) => void handleRenameManga(item)}
              onSearchWeb={(item, provider) => void handleSearchWeb(item, provider)}
              onOpenInFolder={(mangaId) => void handleOpenInFolder(mangaId)}
              onDeleteManga={handleRequestDeleteManga}
              onOpenManga={onOpenManga}
            />
          </section>
        </div>
      </div>

      <TagManagementDialog
        open={tagDialogOpen}
        tags={tags}
        newTagLabel={newTagLabel}
        onClose={closeTagDialog}
        onSetNewTagLabel={setNewTagLabel}
        onUpsertTag={upsertDraftTag}
        onRemoveTag={removeGlobalTag}
        onClearAllTags={clearAllTags}
      />

      <DeleteMangaDialog
        open={deleteDialogOpen}
        target={deleteTarget}
        deleting={deleting}
        onClose={() => closeDeleteDialog()}
        onConfirm={() => void handleConfirmDeleteManga()}
      />

      <AddTagPopover
        open={addTagDialogOpen}
        anchor={addTagAnchor}
        mangaTitle={addTagTarget?.title ?? null}
        draftTags={addTagDraft}
        inputTagName={addTagInput}
        availableTags={tags.map((tag) => tag.label)}
        saving={addTagSaving}
        error={addTagError}
        onInputTagNameChange={setAddTagInput}
        onAppendInputTag={appendInputTag}
        onAppendTag={appendDraftTag}
        onRemoveTag={removeDraftTag}
        onClose={() => closeAddTagDialog()}
        onSubmit={() => void handleConfirmAddTag()}
      />
    </main>
  );
}
