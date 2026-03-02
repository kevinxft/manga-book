import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { DirectoryAlias, MangaBookWithCover } from '@shared/types';
import { ipcInvoke } from '@renderer/ipc/client';
import { cn } from '@renderer/lib/utils';
import { useLibraryStore } from '@renderer/stores/libraryStore';
import { LibraryHeader } from './components/LibraryHeader';
import { LibraryScanOverlay } from './components/LibraryScanOverlay';
import { LibrarySidebar } from './components/LibrarySidebar';
import { MangaGrid } from './components/MangaGrid';
import { TagManagementDialog } from './components/TagManagementDialog';
import { DeleteMangaDialog } from '@renderer/pages/Organizer/components/DeleteMangaDialog';
import { TAG_COLOR_OPTIONS, useTagEditor } from './hooks/useTagEditor';
import type { LibraryStatusFilter, MangaCategoryFilter, SortKey } from './types';
import { getMangaPathCategory } from './utils';
import { buildOrganizerCategories } from '@renderer/pages/Organizer/utils';

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
  const [statusFilter, setStatusFilter] = useState<LibraryStatusFilter>('all');
  const [operationError, setOperationError] = useState<string | null>(null);
  const [aliases, setAliases] = useState<DirectoryAlias[]>([]);
  const [authorDirectories, setAuthorDirectories] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MangaBookWithCover | null>(null);
  const [deleting, setDeleting] = useState(false);
  const hasIpcBridge = typeof window !== 'undefined' && typeof window.mangaBookApi?.invoke === 'function';

  const {
    tags,
    selectedTags,
    tagDialogOpen,
    draftTags,
    newTagLabel,
    newTagColor,
    openTagDialog,
    closeTagDialog,
    toggleTagSelection,
    setNewTagLabel,
    setNewTagColor,
    upsertDraftTag,
    removeDraftTag,
    saveTags
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

  const scanRunning = progress.status === 'running';

  useEffect(() => {
    if (!hasIpcBridge) return;
    void fetchSources();
  }, [fetchSources, hasIpcBridge]);

  useEffect(() => {
    if (activeMenu === 'all') {
      return;
    }
    const sourceId = activeMenu.startsWith('source:') ? activeMenu.slice('source:'.length) : '';
    if (!sourceId || !sources.some((source) => source.id === sourceId)) {
      setActiveMenu('all');
    }
  }, [activeMenu, sources]);

  useEffect(() => {
    if (!hasIpcBridge) return;
    void fetchMangas({ query: search, sortBy });
  }, [fetchMangas, hasIpcBridge, search, sortBy]);

  useEffect(() => {
    if (!hasIpcBridge) return;
    void (async () => {
      try {
        const [aliasItems, directoryItems] = await Promise.all([
          ipcInvoke('organizer.listAliases', undefined),
          ipcInvoke('organizer.listAuthorDirectories', undefined)
        ]);
        setAliases(aliasItems);
        setAuthorDirectories(directoryItems.map((item) => item.directory));
      } catch {
        // ignore organizer helper data load failure
      }
    })();
  }, [hasIpcBridge]);

  useEffect(() => {
    if (!hasIpcBridge) return;
    const timer = setInterval(() => {
      void refreshScanProgress();
    }, 1200);

    return () => clearInterval(timer);
  }, [hasIpcBridge, refreshScanProgress]);

  const visibleMangas = useMemo(() => {
    const selectedSourcePath =
      activeMenu.startsWith('source:') ? sources.find((source) => source.id === activeMenu.slice('source:'.length))?.path : null;

    const bySource = selectedSourcePath ? mangas.filter((manga) => manga.sourceFolderPath === selectedSourcePath) : mangas;
    const byStatus = bySource.filter((manga) => {
      if (statusFilter === 'all') {
        return true;
      }
      const category = getMangaPathCategory(manga.folderPath, manga.sourceFolderPath);
      const organized = category !== 'other';
      return statusFilter === 'organized' ? organized : !organized;
    });

    if (categoryFilter === 'all') {
      return byStatus;
    }
    return byStatus.filter((manga) => getMangaPathCategory(manga.folderPath, manga.sourceFolderPath) === categoryFilter);
  }, [activeMenu, categoryFilter, mangas, sources, statusFilter]);

  const sourceMangaCountByPath = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const manga of mangas) {
      counts[manga.sourceFolderPath] = (counts[manga.sourceFolderPath] ?? 0) + 1;
    }
    return counts;
  }, [mangas]);

  const quickMoveCategories = useMemo(() => {
    const aliasMap = new Map<string, string[]>();
    for (const item of aliases) {
      const key = item.canonicalName.trim().toLocaleLowerCase();
      const prev = aliasMap.get(key) ?? [];
      if (!prev.some((name) => name.toLocaleLowerCase() === item.alias.toLocaleLowerCase())) {
        prev.push(item.alias);
        aliasMap.set(key, prev);
      }
    }

    return buildOrganizerCategories(mangas, authorDirectories).map((category) => ({
      ...category,
      aliases: aliasMap.get(category.label.trim().toLocaleLowerCase()) ?? []
    }));
  }, [aliases, authorDirectories, mangas]);

  const refreshCurrentList = async () => {
    await fetchMangas({ query: search, sortBy });
  };

  const handleQuickMoveManga = async (mangaId: string, destinationPath: string) => {
    if (!hasIpcBridge) return;
    setOperationError(null);
    try {
      await ipcInvoke('organizer.moveManga', { mangaId, destinationPath });
      await refreshCurrentList();
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : '快速移动失败');
    }
  };

  const handleRenameManga = async (item: MangaBookWithCover) => {
    const nextTitle = window.prompt('请输入新的漫画名称', item.title);
    const trimmed = nextTitle?.trim();
    if (!trimmed || trimmed === item.title) {
      return;
    }
    setOperationError(null);
    try {
      await ipcInvoke('organizer.renameManga', { mangaId: item.id, newTitle: trimmed });
      await refreshCurrentList();
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : '重命名失败');
    }
  };

  const handleAddTagManga = async (item: MangaBookWithCover) => {
    if (!hasIpcBridge) {
      setOperationError('当前运行在普通浏览器环境，无法添加标签。请使用 bun run dev 启动 Electron 窗口。');
      return;
    }
    const tagName = window.prompt('请输入标签名称', '');
    const trimmed = tagName?.trim();
    if (!trimmed) {
      return;
    }
    setOperationError(null);
    try {
      const result = await ipcInvoke('tag.addToManga', { mangaId: item.id, tagName: trimmed });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('manga-book-tags-updated'));
        window.alert(result.linked ? `已添加标签：${result.tag.name}` : `该漫画已存在标签：${result.tag.name}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '添加标签失败';
      if (message.includes('No handler registered for') && message.includes('tag.')) {
        setOperationError('当前 Electron 主进程尚未加载标签功能，请重启 bun run dev 后再试。');
        return;
      }
      setOperationError(message);
    }
  };

  const handleOpenInFolder = async (mangaId: string) => {
    setOperationError(null);
    try {
      await ipcInvoke('organizer.openMangaFolder', { mangaId });
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : '打开文件夹失败');
    }
  };

  const handleRequestDeleteManga = (item: MangaBookWithCover) => {
    setOperationError(null);
    setDeleteTarget(item);
    setDeleteDialogOpen(true);
  };

  const closeDeleteDialog = (force = false) => {
    if (deleting && !force) {
      return;
    }
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
  };

  const handleConfirmDeleteManga = async () => {
    if (!deleteTarget || deleting) {
      return;
    }
    setDeleting(true);
    setOperationError(null);
    try {
      await ipcInvoke('organizer.deleteManga', { mangaId: deleteTarget.id, withFiles: true });
      await refreshCurrentList();
      closeDeleteDialog(true);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : '删除漫画失败');
    } finally {
      setDeleting(false);
    }
  };

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
              onAddTagManga={(item) => void handleAddTagManga(item)}
              onRenameManga={(item) => void handleRenameManga(item)}
              onOpenInFolder={(mangaId) => void handleOpenInFolder(mangaId)}
              onDeleteManga={handleRequestDeleteManga}
              onOpenManga={onOpenManga}
            />
          </section>
        </div>
      </div>

      <TagManagementDialog
        open={tagDialogOpen}
        draftTags={draftTags}
        newTagLabel={newTagLabel}
        newTagColor={newTagColor}
        colorOptions={[...TAG_COLOR_OPTIONS]}
        onClose={closeTagDialog}
        onSave={saveTags}
        onSetNewTagLabel={setNewTagLabel}
        onSetNewTagColor={setNewTagColor}
        onUpsertTag={upsertDraftTag}
        onRemoveTag={removeDraftTag}
      />

      <DeleteMangaDialog
        open={deleteDialogOpen}
        target={deleteTarget}
        deleting={deleting}
        onClose={() => closeDeleteDialog()}
        onConfirm={() => void handleConfirmDeleteManga()}
      />
    </main>
  );
}
