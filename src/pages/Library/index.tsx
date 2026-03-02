import { useEffect, useMemo, useState } from 'react';
import type { MangaBookWithCover } from '@shared/types';
import { cn } from '@renderer/lib/utils';
import { useLibraryStore } from '@renderer/stores/libraryStore';
import { LibraryHeader } from './components/LibraryHeader';
import { LibraryScanOverlay } from './components/LibraryScanOverlay';
import { LibrarySidebar } from './components/LibrarySidebar';
import { MangaGrid } from './components/MangaGrid';
import { TagManagementDialog } from './components/TagManagementDialog';
import { TAG_COLOR_OPTIONS, useTagEditor } from './hooks/useTagEditor';
import type { MangaCategoryFilter, SortKey } from './types';
import { getMangaPathCategory } from './utils';

interface LibraryPageProps {
  onOpenManga?: (manga: MangaBookWithCover) => void;
  onOpenSettings?: () => void;
  onOpenOrganizer?: () => void;
}

export function LibraryPage({ onOpenManga, onOpenSettings, onOpenOrganizer }: LibraryPageProps) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('addedAt');
  const [activeMenu, setActiveMenu] = useState('all');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<MangaCategoryFilter>('all');

  const {
    tags,
    selectedTags,
    tagDialogOpen,
    draftTags,
    editingTagId,
    newTagLabel,
    newTagColor,
    openTagDialog,
    closeTagDialog,
    toggleTagSelection,
    setNewTagLabel,
    setNewTagColor,
    upsertDraftTag,
    removeDraftTag,
    startEditDraftTag,
    cancelEditDraftTag,
    saveTags
  } = useTagEditor();

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

  const hasIpcBridge = typeof window !== 'undefined' && typeof window.mangaBookApi?.invoke === 'function';
  const scanRunning = progress.status === 'running';

  useEffect(() => {
    if (!hasIpcBridge) return;
    void fetchSources();
  }, [fetchSources, hasIpcBridge]);

  useEffect(() => {
    if (!hasIpcBridge) return;
    void fetchMangas({ query: search, sortBy });
  }, [fetchMangas, hasIpcBridge, search, sortBy]);

  useEffect(() => {
    if (!hasIpcBridge) return;
    const timer = setInterval(() => {
      void refreshScanProgress();
    }, 1200);

    return () => clearInterval(timer);
  }, [hasIpcBridge, refreshScanProgress]);

  const visibleMangas = useMemo(() => {
    if (categoryFilter === 'all') {
      return mangas;
    }
    return mangas.filter((manga) => getMangaPathCategory(manga.folderPath, manga.sourceFolderPath) === categoryFilter);
  }, [categoryFilter, mangas]);

  const sourceMangaCountByPath = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const manga of mangas) {
      counts[manga.sourceFolderPath] = (counts[manga.sourceFolderPath] ?? 0) + 1;
    }
    return counts;
  }, [mangas]);

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
              onSortByChange={setSortBy}
              onSearchChange={setSearch}
              onSyncSources={() => void syncSources()}
              onCategoryFilterChange={setCategoryFilter}
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

            <MangaGrid mangas={visibleMangas} totalMangaCount={mangas.length} loading={loading} onOpenManga={onOpenManga} />
          </section>
        </div>
      </div>

      <TagManagementDialog
        open={tagDialogOpen}
        draftTags={draftTags}
        editingTagId={editingTagId}
        newTagLabel={newTagLabel}
        newTagColor={newTagColor}
        colorOptions={[...TAG_COLOR_OPTIONS]}
        onClose={closeTagDialog}
        onSave={saveTags}
        onSetNewTagLabel={setNewTagLabel}
        onSetNewTagColor={setNewTagColor}
        onUpsertTag={upsertDraftTag}
        onRemoveTag={removeDraftTag}
        onStartEditTag={startEditDraftTag}
        onCancelEdit={cancelEditDraftTag}
      />
    </main>
  );
}
