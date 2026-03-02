import { useCallback } from 'react';
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
import { useTagEditor } from './hooks/useTagEditor';
import { AddTagPopover } from '@renderer/components/manga/AddTagPopover';
import { useLibraryFilters } from './hooks/useLibraryFilters';
import { useLibraryMangaActions } from './hooks/useLibraryMangaActions';
import { useLibraryMangaTagEditor } from './hooks/useLibraryMangaTagEditor';
import { useLibraryOrganizerCategories } from './hooks/useLibraryOrganizerCategories';
import { useLibraryDataLifecycle } from './hooks/useLibraryDataLifecycle';

interface LibraryPageProps {
  onOpenManga?: (manga: MangaBookWithCover) => void;
  onOpenSettings?: () => void;
  onOpenOrganizer?: () => void;
}

export function LibraryPage({ onOpenManga, onOpenSettings, onOpenOrganizer }: LibraryPageProps) {
  const hasIpcBridge = typeof window !== 'undefined' && typeof window.mangaBookApi?.invoke === 'function';

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
    refreshScanProgress
  } = useLibraryStore();

  const {
    search,
    sortBy,
    activeMenu,
    sidebarCollapsed,
    categoryFilter,
    statusFilter,
    visibleMangas,
    sourceMangaCountByPath,
    setSearch,
    setSortBy,
    setActiveMenu,
    setSidebarCollapsed,
    setCategoryFilter,
    setStatusFilter
  } = useLibraryFilters({
    mangas,
    sources,
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

  const { quickMoveCategories } = useLibraryOrganizerCategories({
    hasIpcBridge,
    mangas
  });

  const refreshCurrentList = useCallback(async () => {
    await fetchMangas({ query: search, sortBy });
  }, [fetchMangas, search, sortBy]);

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
    refreshCurrentList
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
  } = useLibraryMangaTagEditor({
    hasIpcBridge,
    availableTags: tags.map((tag) => tag.label),
    refreshCurrentList,
    setOperationError
  });

  return (
    <main className="h-full w-full bg-[#eceef2] p-1">
      <div className="h-full overflow-hidden rounded-[8px] border border-[#d8dee9] bg-[#f1f2f5]">
        <div
          className={cn(
            'grid h-full overflow-hidden transition-[grid-template-columns] duration-200',
            sidebarCollapsed ? 'grid-cols-[72px_1fr]' : 'grid-cols-[270px_1fr]'
          )}
        >
          <LibrarySidebar
            sidebarCollapsed={sidebarCollapsed}
            activeMenu={activeMenu}
            tags={tags}
            selectedTags={selectedTags}
            sources={sources}
            sourceMangaCountByPath={sourceMangaCountByPath}
            hasIpcBridge={hasIpcBridge}
            onActiveMenuChange={setActiveMenu}
            onSidebarCollapsedChange={setSidebarCollapsed}
            onToggleTag={toggleTagSelection}
            onClearSelectedTags={clearSelectedTags}
            onOpenTagDialog={openTagDialog}
            onPickAndAddSources={() => void pickAndAddSources()}
            onRemoveSource={(sourceId) => {
              void removeSource(sourceId);
            }}
            onOpenSettings={onOpenSettings}
            onOpenOrganizer={onOpenOrganizer}
          />

          <section className="relative flex min-h-0 flex-col bg-[#f3f5f9]">
            <LibraryHeader
              sortBy={sortBy}
              loading={loading}
              hasIpcBridge={hasIpcBridge}
              scanRunning={scanRunning}
              search={search}
              categoryFilter={categoryFilter}
              statusFilter={statusFilter}
              onSortByChange={setSortBy}
              onSearchChange={setSearch}
              onSyncSources={() => void syncSources()}
              onCategoryFilterChange={setCategoryFilter}
              onStatusFilterChange={setStatusFilter}
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
