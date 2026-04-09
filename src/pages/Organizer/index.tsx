import type { MangaBookWithCover } from '@shared/types';
import { useLibraryStore } from '@renderer/stores/libraryStore';
import { useShallow } from 'zustand/react/shallow';
import { AliasManagerDialog } from './components/AliasManagerDialog';
import { OrganizerCategoryPanel } from './components/OrganizerCategoryPanel';
import { CreateAuthorDialog } from './components/CreateAuthorDialog';
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
import { resolveTargetSourcePaths } from '@renderer/pages/Library/utils';

interface OrganizerPageProps {
  onBack?: () => void;
  onOpenManga?: (manga: MangaBookWithCover, queueIds?: string[]) => void;
}

export function OrganizerPage({ onBack, onOpenManga }: OrganizerPageProps) {
  const { sources, mangas, loading, error, fetchMangas, fetchCoverPaths, updateMangaLocal, removeMangaLocal } = useLibraryStore(
    useShallow((state) => ({
      sources: state.sources,
      mangas: state.mangas,
      loading: state.loading,
      error: state.error,
      fetchMangas: state.fetchMangas,
      fetchCoverPaths: state.fetchCoverPaths,
      updateMangaLocal: state.updateMangaLocal,
      removeMangaLocal: state.removeMangaLocal
    }))
  );
  const hasIpcBridge = typeof window !== 'undefined' && typeof window.mangaBookApi?.invoke === 'function';
  const authorDirectories = useOrganizerMetadataStore((state) => state.authorDirectories);
  const targetSourcePaths = resolveTargetSourcePaths(
    sources,
    authorDirectories.map((item) => item.directory)
  );
  const {
    aliases,
    categories,
    organizerItems,
    selectedCategoryKey,
    setSelectedCategoryKey,
    refreshOrganizerMetadata,
    refreshAuthorDirectories,
    upsertAlias,
    removeAliasLocal,
    addAuthorDirectoryLocal
  } = useOrganizerData({
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
  const { selectedIds, setSelectedIds, allVisibleSelected, toggleSelectAllVisible, toggleItem } = useOrganizerSelection({
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
    handleConfirmRenameAuthorDirectory
  } = useOrganizerMutations({
    hasIpcBridge,
    fetchMangas,
    categories,
    aliases,
    selectedCategoryKey,
    selectedIds,
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

  const handleVisibleItemsChange = (items: MangaBookWithCover[]) => {
    void fetchCoverPaths(items.map((item) => item.folderPath));
  };

  return (
    <main className="h-full w-full bg-[#ebedf1] p-2">
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[14px] border border-[#cad3e0] bg-[#f4f6fa] shadow-[0_18px_48px_rgba(32,45,68,0.22)]">
        <OrganizerHeader
          query={query}
          statusFilter={statusFilter}
          sourceFilter={sourceFilter}
          sourceOptions={sourceOptions}
          sortBy={sortBy}
          allVisibleSelected={allVisibleSelected}
          onBack={onBack}
          onQueryChange={setQuery}
          onStatusFilterChange={setStatusFilter}
          onSourceFilterChange={setSourceFilter}
          onSortByChange={setSortBy}
          onToggleSelectAllVisible={toggleSelectAllVisible}
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
              selectedIds={selectedIds}
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
              selectedCategoryKey={selectedCategoryKey}
              selectedCount={selectedIds.size}
              moving={moving}
              creatingAuthor={creatingAuthor}
              hasIpcBridge={hasIpcBridge}
              moveError={moveError}
              onClearMoveError={() => setMoveError(null)}
              onSelectCategory={setSelectedCategoryKey}
              onMoveSelected={() => void handleMoveSelected()}
              onRequestAddAlias={handleRequestAddAlias}
              onRequestRenameCategory={handleRequestRenameAuthorDirectory}
              onRequestCreateAuthor={handleRequestCreateAuthor}
            />
          </div>
        </div>

        <footer className="flex items-center justify-between border-t border-[#d9e0ea] bg-[#f7f9fc] px-5 py-2 text-[11px] font-semibold text-[#6d7d96]">
          <span>
            已选择 {selectedIds.size} 本漫画 {visibleItems.length > 0 ? `· 当前结果 ${visibleItems.length} 本` : ''}
          </span>
          <span className="tracking-[0.06em] text-[#8191a8]">MANGA ORGANIZER</span>
        </footer>
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
