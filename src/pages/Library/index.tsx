import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { MangaBookWithCover } from '@shared/types';
import { useLibraryStore } from '@renderer/stores/libraryStore';
import { useShallow } from 'zustand/react/shallow';
import { LibraryHeader } from './components/LibraryHeader';
import { LibrarySidebar } from './components/LibrarySidebar';
import { MangaGrid } from './components/MangaGrid';
import { TagManagementDialog } from './components/TagManagementDialog';
import { AliasManagerDialog } from '@renderer/pages/Organizer/components/AliasManagerDialog';
import { DeleteAuthorDirectoryDialog } from '@renderer/pages/Organizer/components/DeleteAuthorDirectoryDialog';
import { DeleteMangaDialog } from '@renderer/pages/Organizer/components/DeleteMangaDialog';
import { useMangaTagEditor } from '@renderer/hooks/manga/useMangaTagEditor';
import { useTagEditor } from './hooks/useTagEditor';
import { AddTagPopover } from '@renderer/components/manga/AddTagPopover';
import { MangaPageEditorDialog } from '@renderer/components/manga/MangaPageEditorDialog';
import { RenameMangaDialog } from '@renderer/components/manga/RenameMangaDialog';
import { RenameAuthorDirectoryDialog } from '@renderer/pages/Organizer/components/RenameAuthorDirectoryDialog';
import { CreateLibraryRootDialog } from './components/CreateLibraryRootDialog';
import { useLibraryFilters } from './hooks/useLibraryFilters';
import { useLibraryMangaActions } from './hooks/useLibraryMangaActions';
import { useLibraryOrganizerCategories } from './hooks/useLibraryOrganizerCategories';
import { useLibraryDataLifecycle } from './hooks/useLibraryDataLifecycle';
import { useAliasMutations } from '@renderer/pages/Organizer/hooks/useAliasMutations';
import { useAuthorDirectoryDelete } from '@renderer/pages/Organizer/hooks/useAuthorDirectoryDelete';
import { useAuthorDirectoryImport } from '@renderer/pages/Organizer/hooks/useAuthorDirectoryImport';
import { useAuthorDirectoryRename } from '@renderer/pages/Organizer/hooks/useAuthorDirectoryRename';
import { useOrganizerMutationErrors } from '@renderer/pages/Organizer/hooks/useOrganizerMutationErrors';
import { ipcInvoke } from '@renderer/ipc/client';
import { useOrganizerMetadataStore } from '@renderer/stores/organizerMetadataStore';
import { useLibraryUiStore } from '@renderer/stores/libraryUiStore';
import { buildUnsortedImportSummaries } from './utils';

interface LibraryPageProps {
  active?: boolean;
  onOpenManga?: (manga: MangaBookWithCover, queueIds?: string[]) => void;
  onOpenSettings?: () => void;
  onOpenOrganizer?: () => void;
}

const LIBRARY_SIDEBAR_DEFAULT_WIDTH = 270;
const LIBRARY_SIDEBAR_MIN_WIDTH = 250;
const LIBRARY_SIDEBAR_MAX_WIDTH = 420;
const LIBRARY_SIDEBAR_COLLAPSED_WIDTH = 88;
const LIBRARY_SIDEBAR_RESIZER_WIDTH = 8;
const LIBRARY_MAIN_CONTENT_MIN_WIDTH = 480;

function clampSidebarWidth(width: number, containerWidth?: number): number {
  const containerMaxWidth =
    typeof containerWidth === 'number'
      ? Math.max(LIBRARY_SIDEBAR_MIN_WIDTH, containerWidth - LIBRARY_MAIN_CONTENT_MIN_WIDTH)
      : LIBRARY_SIDEBAR_MAX_WIDTH;
  return Math.min(Math.max(width, LIBRARY_SIDEBAR_MIN_WIDTH), Math.min(LIBRARY_SIDEBAR_MAX_WIDTH, containerMaxWidth));
}

export function LibraryPage({ active = true, onOpenManga, onOpenSettings, onOpenOrganizer }: LibraryPageProps) {
  const hasIpcBridge = typeof window !== 'undefined' && typeof window.mangaBookApi?.invoke === 'function';
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pageEditorLoadRequestRef = useRef(0);
  const [pageEditorOpen, setPageEditorOpen] = useState(false);
  const [pageEditorTarget, setPageEditorTarget] = useState<MangaBookWithCover | null>(null);
  const [pageEditorPaths, setPageEditorPaths] = useState<string[]>([]);
  const [pageEditorLoading, setPageEditorLoading] = useState(false);
  const [pageEditorDeleting, setPageEditorDeleting] = useState(false);
  const [pageEditorError, setPageEditorError] = useState<string | null>(null);
  const [createLibraryRootDialogOpen, setCreateLibraryRootDialogOpen] = useState(false);
  const [createLibraryRootParentPath, setCreateLibraryRootParentPath] = useState<string | null>(null);

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
    libraryRoot,
    sources,
    mangas,
    loading,
    error,
    progress,
    clearError,
    fetchLibraryRoot,
    fetchMangas,
    createLibraryRoot,
    pickLibraryRootParent,
    clearLibraryRoot,
    openLibraryRoot,
    pickAndImportDirectories,
    syncLibrary,
    cancelSync,
    fetchCoverPaths,
    handleScanTaskUpdate,
    refreshScanProgress,
    updateMangaLocal,
    removeMangaLocal
  } = useLibraryStore(
    useShallow((state) => ({
      libraryRoot: state.libraryRoot,
      sources: state.sources,
      mangas: state.mangas,
      loading: state.loading,
      error: state.error,
      progress: state.progress,
      clearError: state.clearError,
      fetchLibraryRoot: state.fetchLibraryRoot,
      fetchMangas: state.fetchMangas,
      createLibraryRoot: state.createLibraryRoot,
      pickLibraryRootParent: state.pickLibraryRootParent,
      clearLibraryRoot: state.clearLibraryRoot,
      openLibraryRoot: state.openLibraryRoot,
      pickAndImportDirectories: state.pickAndImportDirectories,
      syncLibrary: state.syncLibrary,
      cancelSync: state.cancelSync,
      fetchCoverPaths: state.fetchCoverPaths,
      handleScanTaskUpdate: state.handleScanTaskUpdate,
      refreshScanProgress: state.refreshScanProgress,
      updateMangaLocal: state.updateMangaLocal,
      removeMangaLocal: state.removeMangaLocal
    }))
  );
  const { aliases, authorDirectories } = useOrganizerMetadataStore(
    useShallow((state) => ({
      aliases: state.aliases,
      authorDirectories: state.authorDirectories
    }))
  );

  const targetSourcePaths = useMemo(() => {
    if (libraryRoot?.path) {
      return [`${libraryRoot.path}/Authors`];
    }
    const fallbackParent = authorDirectories[0]?.directory;
    if (!fallbackParent) {
      return [];
    }
    const normalized = fallbackParent.replace(/\\/g, '/');
    const parent = normalized.slice(0, normalized.lastIndexOf('/'));
    return parent ? [parent] : [];
  }, [authorDirectories, libraryRoot]);

  const { artistDirectories, quickMoveCategories } = useLibraryOrganizerCategories({
    hasIpcBridge,
    mangas,
    targetSourcePaths
  });

  const unsortedImports = useMemo(() => buildUnsortedImportSummaries(mangas), [mangas]);

  const { sidebarCollapsed, sidebarWidth, setSidebarCollapsed, setSidebarWidth } = useLibraryUiStore(
    useShallow((state) => ({
      sidebarCollapsed: state.sidebarCollapsed,
      sidebarWidth: clampSidebarWidth(state.sidebarWidth || LIBRARY_SIDEBAR_DEFAULT_WIDTH),
      setSidebarCollapsed: state.setSidebarCollapsed,
      setSidebarWidth: state.setSidebarWidth
    }))
  );

  const {
    search,
    sortBy,
    activeMenu,
    visibleMangas,
    sourceMangaCountByPath,
    setSearch,
    setSortBy,
    setActiveMenu
  } = useLibraryFilters({
    mangas,
    artistDirectories,
    selectedTags
  });

  const { scanRunning } = useLibraryDataLifecycle({
    active,
    hasIpcBridge,
    fetchLibraryRoot,
    hasLibraryRoot: Boolean(libraryRoot),
    fetchMangas,
    handleScanTaskUpdate,
    refreshScanProgress,
    progress
  });

  const handleVisibleMangasChange = useCallback((items: MangaBookWithCover[]) => {
    void fetchCoverPaths(items.map((item) => item.folderPath));
  }, [fetchCoverPaths]);

  const closePageEditor = useCallback(() => {
    if (pageEditorDeleting) {
      return;
    }
    pageEditorLoadRequestRef.current += 1;
    setPageEditorOpen(false);
    setPageEditorTarget(null);
    setPageEditorPaths([]);
    setPageEditorError(null);
    setPageEditorLoading(false);
  }, [pageEditorDeleting]);

  const handleRequestEditMangaPages = useCallback(
    async (item: MangaBookWithCover) => {
      if (!hasIpcBridge) {
        setPageEditorError('当前运行在普通浏览器环境，无法编辑漫画页面。');
        return;
      }

      const requestId = pageEditorLoadRequestRef.current + 1;
      pageEditorLoadRequestRef.current = requestId;
      setPageEditorOpen(true);
      setPageEditorTarget(item);
      setPageEditorPaths([]);
      setPageEditorError(null);
      setPageEditorLoading(true);

      try {
        const pages = await ipcInvoke('reader.listPages', { mangaId: item.id });
        if (requestId !== pageEditorLoadRequestRef.current) {
          return;
        }
        setPageEditorPaths(pages);
      } catch (error) {
        if (requestId !== pageEditorLoadRequestRef.current) {
          return;
        }
        setPageEditorError(error instanceof Error ? error.message : '加载漫画页面失败');
      } finally {
        if (requestId === pageEditorLoadRequestRef.current) {
          setPageEditorLoading(false);
        }
      }
    },
    [hasIpcBridge]
  );

  const handleDeleteSelectedPages = useCallback(async (selectedPagePaths: string[]) => {
    if (!pageEditorTarget || selectedPagePaths.length === 0) {
      return;
    }

    if (selectedPagePaths.length >= pageEditorPaths.length) {
      setPageEditorError('至少需要保留 1 页漫画。');
      return;
    }

    setPageEditorDeleting(true);
    setPageEditorError(null);
    const selectedPageSet = new Set(selectedPagePaths);

    try {
      const result = await ipcInvoke('reader.deletePages', {
        mangaId: pageEditorTarget.id,
        pagePaths: selectedPagePaths
      });

      const remainingPagePaths = pageEditorPaths.filter((pagePath) => !selectedPageSet.has(pagePath));
      setPageEditorPaths(remainingPagePaths);

      updateMangaLocal(pageEditorTarget.id, (current) => ({
        ...current,
        totalPages: result.totalPages,
        lastPageIndex: (() => {
          const lastReadPagePath = pageEditorPaths[current.lastPageIndex] ?? null;
          if (lastReadPagePath && !selectedPageSet.has(lastReadPagePath)) {
            const nextIndex = remainingPagePaths.indexOf(lastReadPagePath);
            if (nextIndex >= 0) {
              return nextIndex;
            }
          }
          return Math.min(current.lastPageIndex, Math.max(result.totalPages - 1, 0));
        })(),
        coverPath: current.coverPath && selectedPageSet.has(current.coverPath) ? null : current.coverPath
      }));

      setPageEditorTarget((current) =>
        current
          ? {
              ...current,
              totalPages: result.totalPages,
              lastPageIndex: (() => {
                const lastReadPagePath = pageEditorPaths[current.lastPageIndex] ?? null;
                if (lastReadPagePath && !selectedPageSet.has(lastReadPagePath)) {
                  const nextIndex = remainingPagePaths.indexOf(lastReadPagePath);
                  if (nextIndex >= 0) {
                    return nextIndex;
                  }
                }
                return Math.min(current.lastPageIndex, Math.max(result.totalPages - 1, 0));
              })()
            }
          : current
      );

      await fetchCoverPaths([pageEditorTarget.folderPath], { force: true });
    } catch (error) {
      setPageEditorError(error instanceof Error ? error.message : '删除漫画页面失败');
    } finally {
      setPageEditorDeleting(false);
    }
  }, [fetchCoverPaths, pageEditorPaths, pageEditorTarget, updateMangaLocal]);

  const {
    operationError,
    setOperationError,
    handleQuickMoveManga,
    renameDialogOpen,
    renameTarget,
    renaming,
    handleRequestRenameManga,
    closeRenameDialog,
    handleConfirmRenameManga,
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
  const { setMoveError } = useOrganizerMutationErrors();

  const {
    aliasDialogOpen,
    aliasTargetCategory,
    aliasTargetItems,
    aliasSaving,
    aliasRemoving,
    aliasError,
    closeAliasDialog,
    handleRequestAddAlias,
    handleConfirmAddAlias,
    handleRemoveAlias
  } = useAliasMutations({
    aliases,
    upsertAlias: useOrganizerMetadataStore.getState().upsertAlias,
    removeAliasLocal: useOrganizerMetadataStore.getState().removeAliasLocal,
    setMoveError: (message) => {
      setMoveError(message);
      setOperationError(message);
    }
  });

  const {
    renameAuthorDialogOpen,
    renameAuthorTarget,
    renamingAuthor,
    handleRequestRenameAuthorDirectory,
    closeRenameAuthorDialog,
    handleConfirmRenameAuthorDirectory
  } = useAuthorDirectoryRename({
    hasIpcBridge,
    setSelectedCategoryKey: (value) => setActiveMenu(value ? value.replace(/^artists:/, 'artist:') : 'all'),
    setMoveError: (message) => {
      setMoveError(message);
      setOperationError(message);
    },
    buildCategoryKey: (directoryPath) => `artist:${directoryPath}`
  });

  const {
    deleteAuthorDialogOpen,
    deleteAuthorTarget,
    deletingAuthor,
    deleteAuthorError,
    handleRequestDeleteAuthorDirectory,
    closeDeleteAuthorDialog,
    handleConfirmDeleteAuthorDirectory
  } = useAuthorDirectoryDelete({
    hasIpcBridge,
    fetchMangas,
    refreshOrganizerMetadata: useOrganizerMetadataStore.getState().refreshOrganizerMetadata,
    setSelectedCategoryKey: () => setActiveMenu('all'),
    setMoveError: (message) => {
      setMoveError(message);
      setOperationError(message);
    },
    nextSelectedCategoryKey: 'all'
  });

  const {
    importingAuthorDirectoryPath,
    handleRequestImportToAuthorDirectory
  } = useAuthorDirectoryImport({
    hasIpcBridge,
    fetchMangas,
    refreshAuthorDirectories: useOrganizerMetadataStore.getState().refreshAuthorDirectories,
    setMoveError: (message) => {
      setMoveError(message);
      setOperationError(message);
    }
  });

  const {
    addTagDialogOpen,
    addTagTarget,
    addTagAnchor,
    addTagSaving,
    addTagError,
    openAddTagDialog,
    closeAddTagDialog,
    handleConfirmAddTag
  } = useMangaTagEditor({
    hasIpcBridge,
    updateMangaLocal,
    setError: setOperationError
  });

  const handleSidebarCollapsedChange = useCallback((value: boolean) => {
    setSidebarCollapsed(value);
  }, [setSidebarCollapsed]);

  const handleRequestCreateLibraryRoot = useCallback(async () => {
    const parentPath = await pickLibraryRootParent();
    if (!parentPath) {
      return;
    }

    setCreateLibraryRootParentPath(parentPath);
    setCreateLibraryRootDialogOpen(true);
  }, [pickLibraryRootParent]);

  const handleCloseCreateLibraryRootDialog = useCallback(() => {
    if (loading) {
      return;
    }
    setCreateLibraryRootDialogOpen(false);
    setCreateLibraryRootParentPath(null);
  }, [loading]);

  const handleConfirmCreateLibraryRoot = useCallback(async (directoryName: string) => {
    const trimmedName = directoryName.trim();
    if (!createLibraryRootParentPath || !trimmedName) {
      return;
    }

    await createLibraryRoot(createLibraryRootParentPath, trimmedName);
    if (!useLibraryStore.getState().error) {
      setCreateLibraryRootDialogOpen(false);
      setCreateLibraryRootParentPath(null);
    }
  }, [createLibraryRoot, createLibraryRootParentPath]);

  const handleClearLibraryRoot = useCallback(() => {
    if (!window.confirm('确认只清除当前漫画库配置吗？\n\n这不会删除磁盘上的漫画目录，只会让应用回到首次启动引导。')) {
      return;
    }

    void clearLibraryRoot();
  }, [clearLibraryRoot]);

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

  if (hasIpcBridge && !libraryRoot) {
    return (
      <>
        <main className="flex h-full w-full items-center justify-center bg-slate-50/60 p-8">
          <div className="w-full max-w-[620px] rounded-[32px] border border-slate-200/80 bg-white/90 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <div className="max-w-[440px]">
              <p className="text-[13px] font-bold tracking-[0.22em] text-blue-600">漫画库</p>
              <h1 className="mt-3 text-[34px] font-black tracking-tight text-slate-900">先选择一个唯一的漫画库目录</h1>
              <p className="mt-4 text-[15px] leading-7 text-slate-500">
                后续导入、整理、下载的漫画都会统一放进这个目录。应用会自动创建
                <code className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 text-[13px] text-slate-700">Authors</code>
                、
                <code className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 text-[13px] text-slate-700">Unsorted</code>
                和
                <code className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 text-[13px] text-slate-700">.mangabook</code>
                。
              </p>
            </div>

            <div className="mt-8 flex items-center justify-center">
              <button
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-blue-600 px-5 text-[14px] font-bold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-500 disabled:pointer-events-none disabled:opacity-60"
                onClick={() => void handleRequestCreateLibraryRoot()}
                disabled={loading}
              >
                选择位置并创建漫画库
              </button>
            </div>
          </div>
        </main>

        <CreateLibraryRootDialog
          open={createLibraryRootDialogOpen}
          parentPath={createLibraryRootParentPath}
          creating={loading}
          error={error}
          onClose={handleCloseCreateLibraryRootDialog}
          onSubmit={(value) => void handleConfirmCreateLibraryRoot(value)}
        />
      </>
    );
  }

  return (
    <main className="h-full w-full bg-slate-50/50">
      <div ref={containerRef} className="h-full overflow-hidden">
        <div className="grid h-full overflow-hidden transition-[grid-template-columns] duration-200" style={libraryLayoutStyle}>
          <LibrarySidebar
            sidebarCollapsed={sidebarCollapsed}
            activeMenu={activeMenu}
            artistDirectories={artistDirectories}
            tags={tags}
            selectedTags={selectedTags}
            libraryRoot={libraryRoot}
            sourceMangaCountByPath={sourceMangaCountByPath}
            unsortedImports={unsortedImports}
            hasIpcBridge={hasIpcBridge}
            scanRunning={scanRunning}
            onActiveMenuChange={setActiveMenu}
            onToggleTag={toggleTagSelection}
            onClearSelectedTags={clearSelectedTags}
            onOpenTagDialog={openTagDialog}
            onPickAndSetLibraryRoot={() => handleRequestCreateLibraryRoot()}
            onOpenLibraryRoot={() => void openLibraryRoot()}
            onPickAndImportDirectories={() => void pickAndImportDirectories()}
            onSyncLibrary={() => void syncLibrary()}
            onClearLibraryRoot={handleClearLibraryRoot}
            importingAuthorDirectoryPath={importingAuthorDirectoryPath}
            onRequestImportToCategory={(category) => void handleRequestImportToAuthorDirectory(category)}
            onRequestAddAlias={handleRequestAddAlias}
            onRequestRenameCategory={handleRequestRenameAuthorDirectory}
            onRequestDeleteCategory={handleRequestDeleteAuthorDirectory}
            onOpenSettings={onOpenSettings}
            onOpenOrganizer={onOpenOrganizer}
          />

          {!sidebarCollapsed ? (
            <div
              className="group relative h-full cursor-col-resize bg-transparent z-10"
              onMouseDown={handleSidebarResizeStart}
              role="separator"
              aria-orientation="vertical"
              aria-label="调整侧边栏宽度"
            >
              <div className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-slate-200/50 transition-colors duration-300 group-hover:bg-blue-400" />
              <div className="absolute inset-y-0 left-1/2 w-4 -translate-x-1/2" />
            </div>
          ) : null}

          <section className="relative flex min-h-0 flex-col bg-slate-50/50">
            <LibraryHeader
              sidebarCollapsed={sidebarCollapsed}
              sortBy={sortBy}
              loading={loading}
              mangaCount={visibleMangas.length}
              hasIpcBridge={hasIpcBridge}
              scanRunning={scanRunning}
              progress={progress}
              search={search}
              onSidebarCollapsedChange={handleSidebarCollapsedChange}
              onSortByChange={setSortBy}
              onSearchChange={setSearch}
              onSyncSources={() => void syncLibrary()}
              onCancelSync={() => void cancelSync()}
            />

            {!hasIpcBridge ? (
              <div className="mx-6 mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                当前运行在普通浏览器环境，IPC 不可用。请使用 <code>bun run dev</code> 启动 Electron 窗口。
              </div>
            ) : null}
            {error ? (
              <div className="mx-6 mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <span className="min-w-0 flex-1 break-words">{error}</span>
                <button
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-red-500 transition hover:bg-red-100 hover:text-red-700"
                  onClick={clearError}
                  title="关闭错误提示"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
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
              targetSourcePaths={targetSourcePaths}
              authorDirectoryPaths={authorDirectories.map((item) => item.directory)}
              aliases={aliases}
              scrollToTopKey={activeMenu}
              onVisibleItemsChange={handleVisibleMangasChange}
              onQuickMoveManga={(mangaId, destinationPath) => void handleQuickMoveManga(mangaId, destinationPath)}
              onAddTagManga={(item, anchor) => openAddTagDialog(item, anchor)}
              onEditManga={handleRequestEditMangaPages}
              onRenameManga={handleRequestRenameManga}
              onSearchWeb={(item, provider) => void handleSearchWeb(item, provider)}
              onOpenInFolder={(mangaId) => void handleOpenInFolder(mangaId)}
              onDeleteManga={handleRequestDeleteManga}
              onOpenManga={
                onOpenManga
                  ? (manga) => onOpenManga(manga, visibleMangas.map((item) => item.id))
                  : undefined
              }
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

      <CreateLibraryRootDialog
        open={createLibraryRootDialogOpen}
        parentPath={createLibraryRootParentPath}
        creating={loading}
        error={error}
        onClose={handleCloseCreateLibraryRootDialog}
        onSubmit={(value) => void handleConfirmCreateLibraryRoot(value)}
      />

      <AliasManagerDialog
        open={aliasDialogOpen}
        targetCategory={aliasTargetCategory}
        aliasItems={aliasTargetItems}
        aliasSaving={aliasSaving}
        aliasRemoving={aliasRemoving}
        aliasError={aliasError}
        onClose={() => closeAliasDialog()}
        onSubmit={(value) => void handleConfirmAddAlias(value)}
        onRemoveAlias={(alias) => void handleRemoveAlias(alias)}
      />

      <RenameAuthorDirectoryDialog
        open={renameAuthorDialogOpen}
        target={renameAuthorTarget}
        renaming={renamingAuthor}
        onClose={closeRenameAuthorDialog}
        onSubmit={(value) => void handleConfirmRenameAuthorDirectory(value)}
      />

      <DeleteAuthorDirectoryDialog
        open={deleteAuthorDialogOpen}
        target={deleteAuthorTarget}
        deleting={deletingAuthor}
        error={deleteAuthorError}
        onClose={() => closeDeleteAuthorDialog()}
        onConfirm={() => void handleConfirmDeleteAuthorDirectory()}
      />

      <DeleteMangaDialog
        open={deleteDialogOpen}
        target={deleteTarget}
        deleting={deleting}
        onClose={() => closeDeleteDialog()}
        onConfirm={() => void handleConfirmDeleteManga()}
      />

      <RenameMangaDialog
        open={renameDialogOpen}
        target={renameTarget}
        renaming={renaming}
        onClose={closeRenameDialog}
        onSubmit={(value) => void handleConfirmRenameManga(value)}
      />

      <AddTagPopover
        open={addTagDialogOpen}
        anchor={addTagAnchor}
        mangaId={addTagTarget?.id ?? null}
        mangaTitle={addTagTarget?.title ?? null}
        initialTags={addTagTarget?.tags.map((tag) => tag.name) ?? []}
        availableTags={tags.map((tag) => tag.label)}
        saving={addTagSaving}
        error={addTagError}
        onClose={() => closeAddTagDialog()}
        onSubmit={(values) => void handleConfirmAddTag(values)}
      />

      <MangaPageEditorDialog
        open={pageEditorOpen}
        title={pageEditorTarget?.title ?? null}
        pagePaths={pageEditorPaths}
        loading={pageEditorLoading}
        deleting={pageEditorDeleting}
        error={pageEditorError}
        onClose={closePageEditor}
        onDeleteSelected={handleDeleteSelectedPages}
      />
    </main>
  );
}
