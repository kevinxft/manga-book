import { useEffect, useMemo, useState } from 'react';
import type { MangaBookWithCover } from '@shared/types';
import { ipcInvoke } from '@renderer/ipc/client';
import { useLibraryStore } from '@renderer/stores/libraryStore';
import { OrganizerCategoryPanel } from './components/OrganizerCategoryPanel';
import { OrganizerFileGrid } from './components/OrganizerFileGrid';
import { OrganizerHeader } from './components/OrganizerHeader';
import type { OrganizerCategory, OrganizerSortKey, OrganizerStatusFilter } from './types';
import { buildOrganizerCategories, buildOrganizerItems, filterAndSortOrganizerItems } from './utils';

interface OrganizerPageProps {
  onBack?: () => void;
  onOpenManga?: (manga: MangaBookWithCover) => void;
}

export function OrganizerPage({ onBack, onOpenManga }: OrganizerPageProps) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrganizerStatusFilter>('unorganized');
  const [sortBy, setSortBy] = useState<OrganizerSortKey>('addedAt');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  const { mangas, loading, error, fetchMangas } = useLibraryStore();
  const hasIpcBridge = typeof window !== 'undefined' && typeof window.mangaBookApi?.invoke === 'function';

  useEffect(() => {
    if (!hasIpcBridge) {
      return;
    }
    void fetchMangas({ sortBy: 'addedAt' });
  }, [fetchMangas, hasIpcBridge]);

  useEffect(() => {
    if (!hasIpcBridge || typeof window.mangaBookApi.onOrganizerContextAction !== 'function') {
      return;
    }

    const unsubscribe = window.mangaBookApi.onOrganizerContextAction((payload) => {
      if (payload.type === 'moved') {
        void fetchMangas({ sortBy: 'addedAt' });
        return;
      }

      if (payload.type === 'requestRename') {
        const nextTitle = window.prompt('请输入新的漫画名称', payload.currentTitle);
        const trimmed = nextTitle?.trim();
        if (!trimmed || trimmed === payload.currentTitle) {
          return;
        }
        void (async () => {
          try {
            await ipcInvoke('organizer.renameManga', {
              mangaId: payload.mangaId,
              newTitle: trimmed
            });
            await fetchMangas({ sortBy: 'addedAt' });
          } catch (error) {
            setMoveError(error instanceof Error ? error.message : '重命名失败');
          }
        })();
        return;
      }

      if (payload.type === 'error') {
        setMoveError(payload.message);
      }
    });

    return unsubscribe;
  }, [fetchMangas, hasIpcBridge]);

  const categories = useMemo(() => buildOrganizerCategories(mangas), [mangas]);
  const organizerItems = useMemo(() => buildOrganizerItems(mangas), [mangas]);

  useEffect(() => {
    if (categories.length === 0) {
      setSelectedCategoryKey(null);
      return;
    }

    setSelectedCategoryKey((prev) => {
      if (prev && categories.some((item) => item.key === prev)) {
        return prev;
      }
      return categories[0]?.key ?? null;
    });
  }, [categories]);

  const visibleItems = useMemo(() => {
    return filterAndSortOrganizerItems(organizerItems, query, statusFilter, sortBy);
  }, [organizerItems, query, sortBy, statusFilter]);

  const scopedCount = useMemo(() => {
    if (statusFilter === 'all') {
      return organizerItems.length;
    }
    if (statusFilter === 'organized') {
      return organizerItems.filter((item) => item.organizeStatus === 'organized').length;
    }
    return organizerItems.filter((item) => item.organizeStatus === 'unorganized').length;
  }, [organizerItems, statusFilter]);

  const allVisibleSelected = useMemo(() => {
    if (visibleItems.length === 0) {
      return false;
    }
    return visibleItems.every((item) => selectedIds.has(item.id));
  }, [selectedIds, visibleItems]);

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (visibleItems.length > 0 && visibleItems.every((item) => next.has(item.id))) {
        visibleItems.forEach((item) => next.delete(item.id));
      } else {
        visibleItems.forEach((item) => next.add(item.id));
      }
      return next;
    });
  };

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleMoveSelected = async () => {
    if (!hasIpcBridge || moving || selectedIds.size === 0 || !selectedCategoryKey) {
      return;
    }

    const selectedCategory = categories.find((item) => item.key === selectedCategoryKey);
    if (!selectedCategory) {
      return;
    }

    setMoving(true);
    setMoveError(null);

    try {
      const targets = [...selectedIds];
      for (const mangaId of targets) {
        await ipcInvoke('organizer.moveManga', {
          mangaId,
          destinationPath: selectedCategory.path
        });
      }

      setSelectedIds(new Set());
      await fetchMangas({ sortBy: 'addedAt' });
    } catch (moveIssue) {
      setMoveError(moveIssue instanceof Error ? moveIssue.message : '移动失败，请稍后重试');
    } finally {
      setMoving(false);
    }
  };

  const handleShowContextMenu = (mangaId: string, x: number, y: number) => {
    if (!hasIpcBridge) {
      return;
    }
    void ipcInvoke('organizer.showMangaContextMenu', {
      mangaId,
      x,
      y
    });
  };

  const handleRequestAddAlias = (canonicalCategory: OrganizerCategory) => {
    const aliasValue = window.prompt(`给作者“${canonicalCategory.label}”添加别名`, '');
    const trimmed = aliasValue?.trim();
    if (!trimmed) {
      return;
    }

    void (async () => {
      try {
        await ipcInvoke('organizer.addAlias', {
          alias: trimmed,
          canonicalName: canonicalCategory.label
        });
        await fetchMangas({ sortBy: 'addedAt' });
      } catch (error) {
        setMoveError(error instanceof Error ? error.message : '保存别名失败');
      }
    })();
  };

  return (
    <main className="h-full w-full bg-[#ebedf1] p-2">
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[14px] border border-[#cad3e0] bg-[#f4f6fa] shadow-[0_18px_48px_rgba(32,45,68,0.22)]">
        <OrganizerHeader count={scopedCount} onBack={onBack} />

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
              allVisibleSelected={allVisibleSelected}
              query={query}
              statusFilter={statusFilter}
              sortBy={sortBy}
              onQueryChange={setQuery}
              onStatusFilterChange={setStatusFilter}
              onSortByChange={setSortBy}
              onToggleSelectAllVisible={toggleSelectAllVisible}
              onToggleItem={toggleItem}
              onOpenManga={(item) => onOpenManga?.(item)}
              onShowContextMenu={handleShowContextMenu}
            />

            <OrganizerCategoryPanel
              categories={categories}
              selectedCategoryKey={selectedCategoryKey}
              selectedCount={selectedIds.size}
              moving={moving}
              hasIpcBridge={hasIpcBridge}
              moveError={moveError}
              onSelectCategory={setSelectedCategoryKey}
              onMoveSelected={() => void handleMoveSelected()}
              onRequestAddAlias={handleRequestAddAlias}
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
    </main>
  );
}
