import { memo, useCallback, useMemo } from 'react';
import type { MangaBookWithCover } from '@shared/types';
import { useLibraryStore } from '@renderer/stores/libraryStore';
import { useShallow } from 'zustand/react/shallow';
import { AliasManagerDialog } from './components/AliasManagerDialog';
import { OrganizerCategoryPanel } from './components/OrganizerCategoryPanel';
import { CreateAuthorDialog } from './components/CreateAuthorDialog';
import { DeleteAuthorDirectoryDialog } from './components/DeleteAuthorDirectoryDialog';
import { DeleteMangaDialog } from './components/DeleteMangaDialog';
import { OrganizerFileGrid } from './components/OrganizerFileGrid';
import { OrganizerHeader } from './components/OrganizerHeader';
import { RenameAuthorDirectoryDialog } from './components/RenameAuthorDirectoryDialog';
import { useOrganizerData } from './hooks/useOrganizerData';
import { useOrganizerFilters } from './hooks/useOrganizerFilters';
import { useOrganizerMutations } from './hooks/useOrganizerMutations';
import { useOrganizerSelection } from './hooks/useOrganizerSelection';
import { AddTagPopover } from '@renderer/components/manga/AddTagPopover';
import { RenameMangaDialog } from '@renderer/components/manga/RenameMangaDialog';
import { useOrganizerMetadataStore } from '@renderer/stores/organizerMetadataStore';
import { useOrganizerSelectionStore } from '@renderer/stores/organizerSelectionStore';
import { resolveTargetSourcePaths } from '@renderer/pages/Library/utils';

interface OrganizerPageProps {
  active?: boolean;
  onBack?: () => void;
  onOpenManga?: (manga: MangaBookWithCover, queueIds?: string[]) => void;
}

const OrganizerFooter = memo(function OrganizerFooter({ visibleCount }: { visibleCount: number }) {
  const selectedCount = useOrganizerSelectionStore((state) => state.selectedIds.size);
  return (
    <footer className="flex items-center justify-between border-t border-slate-200/50 bg-white/50 backdrop-blur-md px-6 py-2.5 text-[11px] font-bold text-slate-400">
      <span className="text-slate-500">
        已选择 <strong className="text-blue-600">{selectedCount}</strong> 本典藏 {visibleCount > 0 ? `· 当前结果 ${visibleCount} 本` : ''}
      </span>
      <span className="tracking-[0.15em]">ORGANIZER</span>
    </footer>
  );
});

const EMPTY_SOURCES = [] as ReturnType<typeof useLibraryStore.getState>['sources'];
const EMPTY_MANGAS = [] as ReturnType<typeof useLibraryStore.getState>['mangas'];
const EMPTY_AUTHOR_DIRECTORIES = [] as ReturnType<typeof useOrganizerMetadataStore.getState>['authorDirectories'];
const noopAsync = async () => {};
const noop = () => {};

export function OrganizerPage({ active = true, onBack, onOpenManga }: OrganizerPageProps) {
  const { sources, mangas, loading, error, fetchMangas, fetchCoverPaths, updateMangaLocal, removeMangaLocal } = useLibraryStore(
    useShallow((state) => ({
      sources: active ? state.sources : EMPTY_SOURCES,
      mangas: active ? state.mangas : EMPTY_MANGAS,
      loading: active ? state.loading : false,
      error: active ? state.error : null,
      fetchMangas: active ? state.fetchMangas : noopAsync,
      fetchCoverPaths: active ? state.fetchCoverPaths : noopAsync,
      updateMangaLocal: active ? state.updateMangaLocal : noop,
      removeMangaLocal: active ? state.removeMangaLocal : noop
    }))
  );
  const hasIpcBridge = active && typeof window !== 'undefined' && typeof window.mangaBookApi?.invoke === 'function';
  const authorDirectories = useOrganizerMetadataStore((state) => (active ? state.authorDirectories : EMPTY_AUTHOR_DIRECTORIES));
  const authorDirectoryPaths = useMemo(
    () => authorDirectories.map((item) => item.directory),
    [authorDirectories]
  );
  const targetSourcePaths = useMemo(
    () => resolveTargetSourcePaths(sources, authorDirectoryPaths),
    [authorDirectoryPaths, sources]
  );
  const {
    aliases,
    categories,
    organizerItems,
    setSelectedCategoryKey,
    refreshOrganizerMetadata,
    refreshAuthorDirectories,
    upsertAlias,
    removeAliasLocal,
    addAuthorDirectoryLocal
  } = useOrganizerData({
    active,
    mangas,
    hasIpcBridge,
    fetchMangas,
    targetSourcePaths
  });
  const {
    query,
    setQuery,
    statusFilter,
    setStatusFilter,
    sourceFilter,
    setSourceFilter,
    sourceOptions,
    sortBy,
    setSortBy,
    visibleItems
  } = useOrganizerFilters({
    organizerItems
  });
  const { setSelectedIds, toggleItem } = useOrganizerSelection({
    visibleItems
  });
  const {
    moving,
    moveError,
    setMoveError,
    handleMoveSelected,
    handleQuickMoveSingle,
    handleAddTagManga,
    addTagDialogOpen,
    addTagTarget,
    addTagAnchor,
    addTagSaving,
    addTagError,
    availableTagNames,
    closeAddTagDialog,
    handleConfirmAddTag,
    renameDialogOpen,
    renameTarget,
    renaming,
    handleRequestRenameManga,
    closeRenameDialog,
    handleConfirmRenameManga,
    handleSearchWeb,
    handleOpenInFolder,
    deleteDialogOpen,
    deleteTarget,
    deleting,
    handleRequestDeleteManga,
    closeDeleteDialog,
    handleConfirmDeleteManga,
    aliasDialogOpen,
    aliasTargetCategory,
    aliasTargetItems,
    aliasSaving,
    aliasRemoving,
    aliasError,
    closeAliasDialog,
    handleRequestAddAlias,
    handleConfirmAddAlias,
    handleRemoveAlias,
    createAuthorDialogOpen,
    creatingAuthor,
    createAuthorError,
    closeCreateAuthorDialog,
    handleRequestCreateAuthor,
    handleConfirmCreateAuthor,
    renameAuthorDialogOpen,
    renameAuthorTarget,
    renamingAuthor,
    handleRequestRenameAuthorDirectory,
    closeRenameAuthorDialog,
    handleConfirmRenameAuthorDirectory,
    deleteAuthorDialogOpen,
    deleteAuthorTarget,
    deletingAuthor,
    deleteAuthorError,
    handleRequestDeleteAuthorDirectory,
    closeDeleteAuthorDialog,
    handleConfirmDeleteAuthorDirectory
  } = useOrganizerMutations({
    hasIpcBridge,
    fetchMangas,
    categories,
    aliases,
    setSelectedIds,
    setSelectedCategoryKey,
    removeMangaLocal,
    refreshOrganizerMetadata,
    refreshAuthorDirectories,
    updateMangaLocal,
    upsertAlias,
    removeAliasLocal,
    addAuthorDirectoryLocal
  });

  const handleVisibleItemsChange = useCallback((items: MangaBookWithCover[]) => {
    void fetchCoverPaths(items.map((item) => item.folderPath));
  }, [fetchCoverPaths]);

  return (
    <main className="h-full w-full bg-slate-50/50">
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <OrganizerHeader
          query={query}
          statusFilter={statusFilter}
          sourceFilter={sourceFilter}
          sourceOptions={sourceOptions}
          sortBy={sortBy}
          visibleItems={visibleItems}
          onBack={onBack}
          onQueryChange={setQuery}
          onStatusFilterChange={setStatusFilter}
          onSourceFilterChange={setSourceFilter}
          onSortByChange={setSortBy}
        />

        {!hasIpcBridge ? (
          <div className="mx-7 mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            当前运行在普通浏览器环境，IPC 不可用。请使用 <code>bun run dev</code> 启动 Electron 窗口。
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-hidden">
          <div className="flex h-full min-h-0">
            <OrganizerFileGrid
              loading={loading}
              error={error}
              visibleItems={visibleItems}
              categories={categories}
              onVisibleItemsChange={handleVisibleItemsChange}
              onToggleItem={toggleItem}
              onOpenManga={(item) => onOpenManga?.(item, visibleItems.map((visibleItem) => visibleItem.id))}
              onQuickMoveManga={handleQuickMoveSingle}
              onAddTagManga={(item, anchor) => void handleAddTagManga(item, anchor)}
              onRenameManga={handleRequestRenameManga}
              onSearchWeb={handleSearchWeb}
              onOpenInFolder={handleOpenInFolder}
              onDeleteManga={handleRequestDeleteManga}
            />

            <OrganizerCategoryPanel
              categories={categories}
              moving={moving}
              creatingAuthor={creatingAuthor}
              hasIpcBridge={hasIpcBridge}
              moveError={moveError}
              onClearMoveError={() => setMoveError(null)}
              onMoveSelected={() => void handleMoveSelected()}
              onRequestAddAlias={handleRequestAddAlias}
              onRequestRenameCategory={handleRequestRenameAuthorDirectory}
              onRequestDeleteCategory={handleRequestDeleteAuthorDirectory}
              onRequestCreateAuthor={handleRequestCreateAuthor}
            />
          </div>
        </div>

        <OrganizerFooter visibleCount={visibleItems.length} />
      </div>

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

      <CreateAuthorDialog
        open={createAuthorDialogOpen}
        creating={creatingAuthor}
        error={createAuthorError}
        onClose={() => closeCreateAuthorDialog()}
        onSubmit={(value) => void handleConfirmCreateAuthor(value)}
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
        availableTags={availableTagNames}
        saving={addTagSaving}
        error={addTagError}
        onClose={() => closeAddTagDialog()}
        onSubmit={(values) => void handleConfirmAddTag(values)}
      />
    </main>
  );
}
