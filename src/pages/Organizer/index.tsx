import { useCallback } from 'react';
import type { MangaBookWithCover } from '@shared/types';
import { useLibraryStore } from '@renderer/stores/libraryStore';
import { AliasManagerDialog } from './components/AliasManagerDialog';
import { OrganizerCategoryPanel } from './components/OrganizerCategoryPanel';
import { CreateAuthorDialog } from './components/CreateAuthorDialog';
import { DeleteMangaDialog } from './components/DeleteMangaDialog';
import { OrganizerFileGrid } from './components/OrganizerFileGrid';
import { OrganizerHeader } from './components/OrganizerHeader';
import { useOrganizerData } from './hooks/useOrganizerData';
import { useOrganizerFilters } from './hooks/useOrganizerFilters';
import { useOrganizerMutations } from './hooks/useOrganizerMutations';
import { useOrganizerSelection } from './hooks/useOrganizerSelection';
import { AddTagPopover } from '@renderer/components/manga/AddTagPopover';

interface OrganizerPageProps {
  onBack?: () => void;
  onOpenManga?: (manga: MangaBookWithCover) => void;
}

export function OrganizerPage({ onBack, onOpenManga }: OrganizerPageProps) {
  const { mangas, loading, error, fetchMangas } = useLibraryStore();
  const hasIpcBridge = typeof window !== 'undefined' && typeof window.mangaBookApi?.invoke === 'function';
  const refreshMangas = useCallback(() => fetchMangas({ sortBy: 'addedAt' }), [fetchMangas]);
  const {
    aliases,
    categories,
    organizerItems,
    selectedCategoryKey,
    setSelectedCategoryKey,
    refreshAuthorDirectories,
    upsertAlias,
    removeAliasLocal,
    addAuthorDirectoryLocal
  } = useOrganizerData({
    mangas,
    hasIpcBridge,
    fetchMangas
  });
  const { query, setQuery, statusFilter, setStatusFilter, sortBy, setSortBy, visibleItems } = useOrganizerFilters({
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
    addTagInput,
    setAddTagInput,
    addTagDraft,
    appendInputTag,
    appendDraftTag,
    removeDraftTag,
    addTagSaving,
    addTagError,
    availableTagNames,
    closeAddTagDialog,
    handleConfirmAddTag,
    handleRenameSingle,
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
    aliasInput,
    setAliasInput,
    aliasSaving,
    aliasRemoving,
    aliasError,
    closeAliasDialog,
    handleRequestAddAlias,
    handleConfirmAddAlias,
    handleRemoveAlias,
    createAuthorDialogOpen,
    newAuthorName,
    setNewAuthorName,
    creatingAuthor,
    createAuthorError,
    closeCreateAuthorDialog,
    handleRequestCreateAuthor,
    handleConfirmCreateAuthor
  } = useOrganizerMutations({
    hasIpcBridge,
    categories,
    aliases,
    selectedCategoryKey,
    selectedIds,
    setSelectedIds,
    setSelectedCategoryKey,
    refreshMangas,
    refreshAuthorDirectories,
    upsertAlias,
    removeAliasLocal,
    addAuthorDirectoryLocal
  });

  return (
    <main className="h-full w-full bg-[#ebedf1] p-2">
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[14px] border border-[#cad3e0] bg-[#f4f6fa] shadow-[0_18px_48px_rgba(32,45,68,0.22)]">
        <OrganizerHeader
          query={query}
          statusFilter={statusFilter}
          sortBy={sortBy}
          allVisibleSelected={allVisibleSelected}
          onBack={onBack}
          onQueryChange={setQuery}
          onStatusFilterChange={setStatusFilter}
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
              onToggleItem={toggleItem}
              onOpenManga={(item) => onOpenManga?.(item)}
              onQuickMoveManga={handleQuickMoveSingle}
              onAddTagManga={(item, anchor) => void handleAddTagManga(item, anchor)}
              onRenameManga={handleRenameSingle}
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
              onRequestCreateAuthor={handleRequestCreateAuthor}
            />
          </div>
        </div>

        <footer className="flex items-center justify-between border-t border-[#d9e0ea] bg-[#f7f9fc] px-7 py-3 text-[12px] font-semibold text-[#6d7d96]">
          <span>
            已选择 {selectedIds.size} 本漫画 {visibleItems.length > 0 ? `· 当前结果 ${visibleItems.length} 本` : ''}
          </span>
          <span className="tracking-[0.08em] text-[#8191a8]">MANGA ORGANIZER</span>
        </footer>
      </div>

      <AliasManagerDialog
        open={aliasDialogOpen}
        targetCategory={aliasTargetCategory}
        aliasItems={aliasTargetItems}
        aliasInput={aliasInput}
        aliasSaving={aliasSaving}
        aliasRemoving={aliasRemoving}
        aliasError={aliasError}
        onAliasInputChange={setAliasInput}
        onClose={() => closeAliasDialog()}
        onSubmit={() => void handleConfirmAddAlias()}
        onRemoveAlias={(alias) => void handleRemoveAlias(alias)}
      />

      <CreateAuthorDialog
        open={createAuthorDialogOpen}
        authorName={newAuthorName}
        creating={creatingAuthor}
        error={createAuthorError}
        onAuthorNameChange={setNewAuthorName}
        onClose={() => closeCreateAuthorDialog()}
        onSubmit={() => void handleConfirmCreateAuthor()}
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
        availableTags={availableTagNames}
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
