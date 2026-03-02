import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DirectoryAlias, MangaBookWithCover } from '@shared/types';
import { X } from 'lucide-react';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
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
  const [aliasDialogOpen, setAliasDialogOpen] = useState(false);
  const [aliasTargetCategory, setAliasTargetCategory] = useState<OrganizerCategory | null>(null);
  const [aliasInput, setAliasInput] = useState('');
  const [aliasSaving, setAliasSaving] = useState(false);
  const [aliasRemoving, setAliasRemoving] = useState<string | null>(null);
  const [aliasError, setAliasError] = useState<string | null>(null);
  const [aliases, setAliases] = useState<DirectoryAlias[]>([]);
  const [authorDirectories, setAuthorDirectories] = useState<string[]>([]);
  const [createAuthorDialogOpen, setCreateAuthorDialogOpen] = useState(false);
  const [newAuthorName, setNewAuthorName] = useState('');
  const [creatingAuthor, setCreatingAuthor] = useState(false);
  const [createAuthorError, setCreateAuthorError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MangaBookWithCover | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { mangas, loading, error, fetchMangas } = useLibraryStore();
  const hasIpcBridge = typeof window !== 'undefined' && typeof window.mangaBookApi?.invoke === 'function';

  const fetchAliases = useCallback(async () => {
    if (!hasIpcBridge) {
      return;
    }
    try {
      const records = await ipcInvoke('organizer.listAliases', undefined);
      setAliases(records);
    } catch {
      // ignore alias load errors to avoid blocking page
    }
  }, [hasIpcBridge]);

  const fetchAuthorDirectories = useCallback(async () => {
    if (!hasIpcBridge) {
      return;
    }
    try {
      const items = await ipcInvoke('organizer.listAuthorDirectories', undefined);
      setAuthorDirectories(items.map((item) => item.directory));
    } catch {
      // ignore author directory load errors to avoid blocking page
    }
  }, [hasIpcBridge]);

  useEffect(() => {
    if (!hasIpcBridge) {
      return;
    }
    void (async () => {
      await Promise.all([fetchMangas({ sortBy: 'addedAt' }), fetchAliases(), fetchAuthorDirectories()]);
    })();
  }, [fetchAliases, fetchAuthorDirectories, fetchMangas, hasIpcBridge]);

  const categories = useMemo(() => {
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
  const organizerItems = useMemo(() => buildOrganizerItems(mangas, aliases), [aliases, mangas]);
  const aliasTargetItems = useMemo(() => {
    if (!aliasTargetCategory) {
      return [] as DirectoryAlias[];
    }
    const canonicalKey = aliasTargetCategory.label.trim().toLocaleLowerCase();
    return aliases.filter((item) => item.canonicalName.trim().toLocaleLowerCase() === canonicalKey);
  }, [aliasTargetCategory, aliases]);

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

  const handleQuickMoveSingle = async (mangaId: string, destinationPath: string) => {
    if (!hasIpcBridge) {
      return;
    }

    setMoveError(null);
    try {
      await ipcInvoke('organizer.moveManga', { mangaId, destinationPath });
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(mangaId);
        return next;
      });
      await fetchMangas({ sortBy: 'addedAt' });
    } catch (error) {
      setMoveError(error instanceof Error ? error.message : '快速移动失败');
    }
  };

  const handleRenameSingle = async (item: MangaBookWithCover) => {
    const nextTitle = window.prompt('请输入新的漫画名称', item.title);
    const trimmed = nextTitle?.trim();
    if (!trimmed || trimmed === item.title) {
      return;
    }

    setMoveError(null);
    try {
      await ipcInvoke('organizer.renameManga', {
        mangaId: item.id,
        newTitle: trimmed
      });
      await fetchMangas({ sortBy: 'addedAt' });
    } catch (error) {
      setMoveError(error instanceof Error ? error.message : '重命名失败');
    }
  };

  const handleOpenInFolder = async (mangaId: string) => {
    setMoveError(null);
    try {
      await ipcInvoke('organizer.openMangaFolder', { mangaId });
    } catch (error) {
      setMoveError(error instanceof Error ? error.message : '打开文件夹失败');
    }
  };

  const handleRequestDeleteManga = (item: MangaBookWithCover) => {
    setMoveError(null);
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
    setMoveError(null);
    try {
      await ipcInvoke('organizer.deleteManga', { mangaId: deleteTarget.id, withFiles: true });
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteTarget.id);
        return next;
      });
      await fetchMangas({ sortBy: 'addedAt' });
      closeDeleteDialog(true);
    } catch (error) {
      setMoveError(error instanceof Error ? error.message : '删除漫画失败');
    } finally {
      setDeleting(false);
    }
  };

  const closeAliasDialog = (force = false) => {
    if (aliasSaving && !force) {
      return;
    }
    setAliasDialogOpen(false);
    setAliasTargetCategory(null);
    setAliasInput('');
    setAliasRemoving(null);
    setAliasError(null);
  };

  const handleRequestAddAlias = (canonicalCategory: OrganizerCategory) => {
    setMoveError(null);
    setAliasError(null);
    setAliasInput('');
    setAliasTargetCategory(canonicalCategory);
    setAliasDialogOpen(true);
  };

  const closeCreateAuthorDialog = (force = false) => {
    if (creatingAuthor && !force) {
      return;
    }
    setCreateAuthorDialogOpen(false);
    setNewAuthorName('');
    setCreateAuthorError(null);
  };

  const handleRequestCreateAuthor = () => {
    setMoveError(null);
    setCreateAuthorError(null);
    setNewAuthorName('');
    setCreateAuthorDialogOpen(true);
  };

  const handleConfirmCreateAuthor = async () => {
    if (!hasIpcBridge || creatingAuthor) {
      return;
    }

    const trimmed = newAuthorName.trim();
    if (!trimmed) {
      setCreateAuthorError('请输入作者名称');
      return;
    }

    setCreatingAuthor(true);
    setCreateAuthorError(null);
    setMoveError(null);
    try {
      const selectedCategory = categories.find((item) => item.key === selectedCategoryKey) ?? null;
      const result = await ipcInvoke('organizer.createAuthorDirectory', {
        name: trimmed,
        basePath: selectedCategory?.path
      });
      setAuthorDirectories((prev) => {
        const next = new Set(prev);
        next.add(result.path);
        return Array.from(next);
      });
      setSelectedCategoryKey(`artists:${result.path}`);
      closeCreateAuthorDialog(true);
      if (!result.created) {
        setMoveError('作者目录已存在，已自动定位。');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '新建作者失败';
      setCreateAuthorError(message);
      setMoveError(message);
    } finally {
      setCreatingAuthor(false);
    }
  };

  const handleConfirmAddAlias = async () => {
    if (!aliasTargetCategory || aliasSaving) {
      return;
    }

    const trimmed = aliasInput.trim();
    if (!trimmed) {
      setAliasError('请输入别名');
      return;
    }

    setAliasSaving(true);
    setAliasError(null);
    setMoveError(null);
    try {
      const storedAlias = await ipcInvoke('organizer.addAlias', {
        alias: trimmed,
        canonicalName: aliasTargetCategory.label
      });
      setAliases((prev) => {
        const aliasKey = storedAlias.alias.trim().toLocaleLowerCase();
        const next = prev.filter((item) => item.alias.trim().toLocaleLowerCase() !== aliasKey);
        next.push(storedAlias);
        next.sort((a, b) => a.alias.localeCompare(b.alias, 'zh-Hans-CN'));
        return next;
      });
      closeAliasDialog(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存别名失败';
      setAliasError(message);
      setMoveError(message);
    } finally {
      setAliasSaving(false);
    }
  };

  const handleRemoveAlias = async (aliasName: string) => {
    if (!aliasTargetCategory || aliasSaving || aliasRemoving) {
      return;
    }

    setAliasRemoving(aliasName);
    setAliasError(null);
    setMoveError(null);
    try {
      try {
        await ipcInvoke('organizer.removeAlias', { alias: aliasName });
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (message.includes("No handler registered for 'organizer.removeAlias'")) {
          await ipcInvoke('organizer.addAlias', {
            alias: aliasName,
            canonicalName: aliasName
          });
        } else {
          throw error;
        }
      }
      setAliases((prev) => prev.filter((item) => item.alias.trim().toLocaleLowerCase() !== aliasName.trim().toLocaleLowerCase()));
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除别名失败';
      setAliasError(message);
      setMoveError(message);
    } finally {
      setAliasRemoving(null);
    }
  };

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
              onRenameManga={handleRenameSingle}
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

      {aliasDialogOpen && aliasTargetCategory ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-[440px] rounded-xl border border-[#d3dced] bg-[#f9fbff] p-4 shadow-[0_20px_50px_rgba(20,34,58,0.35)]">
            <p className="text-[15px] font-semibold text-[#1f2f48]">管理别名</p>
            <p className="mt-1 text-[12px] text-[#647792]">
              目标目录：<span className="font-semibold text-[#2e4360]">{aliasTargetCategory.label}</span>
            </p>

            <div className="mt-3 rounded-lg border border-[#dde5f1] bg-white/75 p-2.5">
              <p className="text-[11px] font-semibold text-[#7687a0]">已有别名</p>
              {aliasTargetItems.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {aliasTargetItems.map((item) => {
                    const removing = aliasRemoving === item.alias;
                    return (
                      <span
                        key={item.id}
                        className="inline-flex items-center gap-1 rounded-md bg-[#e8eef8] px-1.5 py-1 text-[11px] font-semibold text-[#355173]"
                      >
                        {item.alias}
                        <button
                          className="inline-flex h-4 w-4 items-center justify-center rounded-sm text-[#607593] transition hover:bg-[#d6e0ef] hover:text-[#29425f]"
                          onClick={() => void handleRemoveAlias(item.alias)}
                          title="删除别名"
                          disabled={removing || aliasSaving}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-1 text-[11px] text-[#8b9ab0]">暂无别名</p>
              )}
            </div>

            <form
              className="mt-3 space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                void handleConfirmAddAlias();
              }}
            >
              <Input
                value={aliasInput}
                onChange={(event) => setAliasInput(event.target.value)}
                className="h-9 rounded-lg border-[#d5deea] bg-white text-[13px]"
                placeholder="输入别名，例如：浅葱"
                autoFocus
              />

              {aliasError ? (
                <p className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[12px] text-red-700">
                  {aliasError}
                </p>
              ) : null}

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  className="h-8 rounded-lg border border-[#d2dbe8] bg-white px-3 text-[12px] font-semibold text-[#4d617f] hover:bg-[#f1f5fb]"
                  onClick={() => closeAliasDialog()}
                  disabled={aliasSaving || aliasRemoving !== null}
                >
                  取消
                </Button>
                <Button
                  type="submit"
                  className="h-8 rounded-lg bg-[#2f7fe6] px-3 text-[12px] font-semibold text-white hover:bg-[#236ecc]"
                  disabled={aliasSaving || aliasRemoving !== null}
                >
                  {aliasSaving ? '保存中...' : '保存别名'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {createAuthorDialogOpen ? (
        <div className="fixed inset-0 z-[125] flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-[420px] rounded-xl border border-[#d3dced] bg-[#f9fbff] p-4 shadow-[0_20px_50px_rgba(20,34,58,0.35)]">
            <p className="text-[15px] font-semibold text-[#1f2f48]">新建作者</p>
            <p className="mt-1 text-[12px] text-[#647792]">创建后会出现在右侧整理目录，可直接用于快速移动。</p>

            <form
              className="mt-3 space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                void handleConfirmCreateAuthor();
              }}
            >
              <Input
                value={newAuthorName}
                onChange={(event) => setNewAuthorName(event.target.value)}
                className="h-9 rounded-lg border-[#d5deea] bg-white text-[13px]"
                placeholder="输入作者名"
                autoFocus
              />

              {createAuthorError ? (
                <p className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[12px] text-red-700">
                  {createAuthorError}
                </p>
              ) : null}

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  className="h-8 rounded-lg border border-[#d2dbe8] bg-white px-3 text-[12px] font-semibold text-[#4d617f] hover:bg-[#f1f5fb]"
                  onClick={() => closeCreateAuthorDialog()}
                  disabled={creatingAuthor}
                >
                  取消
                </Button>
                <Button
                  type="submit"
                  className="h-8 rounded-lg bg-[#2f7fe6] px-3 text-[12px] font-semibold text-white hover:bg-[#236ecc]"
                  disabled={creatingAuthor}
                >
                  {creatingAuthor ? '创建中...' : '创建作者'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deleteDialogOpen && deleteTarget ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-[420px] rounded-xl border border-[#d4dceb] bg-[#f9fbff] p-4 shadow-[0_20px_50px_rgba(20,34,58,0.35)]">
            <p className="text-[15px] font-semibold text-[#1f2f48]">确认删除漫画？</p>
            <p className="mt-2 text-[12px] leading-5 text-[#5f7088]">
              将永久删除整个漫画目录及全部图片文件，无法恢复。
            </p>
            <p className="mt-2 rounded-md bg-[#eef3fb] px-2.5 py-2 text-[12px] font-semibold text-[#2e4360]">
              {deleteTarget.title}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                className="h-8 rounded-lg border border-[#d2dbe8] bg-white px-3 text-[12px] font-semibold text-[#4d617f] hover:bg-[#f1f5fb]"
                onClick={() => closeDeleteDialog()}
                disabled={deleting}
              >
                取消
              </Button>
              <Button
                type="button"
                className="h-8 rounded-lg bg-[#c73a3a] px-3 text-[12px] font-semibold text-white hover:bg-[#a83131]"
                onClick={() => void handleConfirmDeleteManga()}
                disabled={deleting}
              >
                {deleting ? '删除中...' : '确认删除'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
