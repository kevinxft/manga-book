import type { Dispatch, SetStateAction } from 'react';
import { useState } from 'react';
import type { MangaBookWithCover } from '@shared/types';
import { ipcInvoke } from '@renderer/ipc/client';
import type { OrganizerCategory } from '../types';
import { getErrorMessage } from './error';

interface UseMangaMutationsArgs {
  hasIpcBridge: boolean;
  categories: OrganizerCategory[];
  selectedCategoryKey: string | null;
  selectedIds: Set<string>;
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>;
  refreshMangas: () => Promise<void>;
  setMoveError: (message: string | null) => void;
}

export function useMangaMutations({
  hasIpcBridge,
  categories,
  selectedCategoryKey,
  selectedIds,
  setSelectedIds,
  refreshMangas,
  setMoveError
}: UseMangaMutationsArgs) {
  const [moving, setMoving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MangaBookWithCover | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [addTagDialogOpen, setAddTagDialogOpen] = useState(false);
  const [addTagTarget, setAddTagTarget] = useState<MangaBookWithCover | null>(null);
  const [addTagAnchor, setAddTagAnchor] = useState<{ x: number; y: number } | null>(null);
  const [addTagInput, setAddTagInput] = useState('');
  const [addTagDraft, setAddTagDraft] = useState<string[]>([]);
  const [addTagSaving, setAddTagSaving] = useState(false);
  const [addTagError, setAddTagError] = useState<string | null>(null);
  const [availableTagNames, setAvailableTagNames] = useState<string[]>([]);

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
      const targets = Array.from(selectedIds);
      const movedIds: string[] = [];
      let firstErrorMessage: string | null = null;

      for (const mangaId of targets) {
        try {
          await ipcInvoke('organizer.moveManga', {
            mangaId,
            destinationPath: selectedCategory.path
          });
          movedIds.push(mangaId);
        } catch (error) {
          if (!firstErrorMessage) {
            firstErrorMessage = getErrorMessage(error, '移动失败，请稍后重试');
          }
        }
      }

      if (movedIds.length > 0) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          movedIds.forEach((id) => next.delete(id));
          return next;
        });
        await refreshMangas();
      }

      if (firstErrorMessage) {
        const failedCount = targets.length - movedIds.length;
        if (movedIds.length > 0) {
          setMoveError(`已移动 ${movedIds.length} 本，${failedCount} 本失败：${firstErrorMessage}`);
        } else {
          setMoveError(firstErrorMessage);
        }
      }
    } catch (error) {
      setMoveError(getErrorMessage(error, '移动失败，请稍后重试'));
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
      await refreshMangas();
    } catch (error) {
      setMoveError(getErrorMessage(error, '快速移动失败'));
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
      await refreshMangas();
    } catch (error) {
      setMoveError(getErrorMessage(error, '重命名失败'));
    }
  };

  const closeAddTagDialog = (force = false) => {
    if (addTagSaving && !force) {
      return;
    }
    setAddTagDialogOpen(false);
    setAddTagTarget(null);
    setAddTagAnchor(null);
    setAddTagInput('');
    setAddTagDraft([]);
    setAddTagError(null);
  };

  const appendDraftTag = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    setAddTagDraft((prev) => {
      if (prev.some((item) => item.toLocaleLowerCase() === trimmed.toLocaleLowerCase())) {
        return prev;
      }
      return [...prev, trimmed];
    });
  };

  const removeDraftTag = (name: string) => {
    const target = name.trim().toLocaleLowerCase();
    setAddTagDraft((prev) => prev.filter((item) => item.toLocaleLowerCase() !== target));
  };

  const appendInputTag = () => {
    const trimmed = addTagInput.trim();
    if (!trimmed) {
      return;
    }
    appendDraftTag(trimmed);
    setAddTagInput('');
  };

  const loadAvailableTagNames = async () => {
    if (!hasIpcBridge) {
      setAvailableTagNames([]);
      return;
    }
    try {
      const items = await ipcInvoke('tag.list', undefined);
      const names = Array.from(new Set(items.map((item) => item.name.trim()).filter((name) => name.length > 0)));
      setAvailableTagNames(names);
    } catch {
      setAvailableTagNames([]);
    }
  };

  const handleAddTagManga = (item: MangaBookWithCover, anchor: { x: number; y: number }) => {
    if (!hasIpcBridge) {
      setMoveError('当前运行在普通浏览器环境，无法添加标签。请使用 bun run dev 启动 Electron 窗口。');
      return;
    }

    setMoveError(null);
    setAddTagTarget(item);
    setAddTagAnchor(anchor);
    setAddTagInput('');
    setAddTagDraft(
      Array.from(new Set(item.tags.map((tag) => tag.name.trim()).filter((name) => name.length > 0)))
    );
    setAddTagError(null);
    setAddTagDialogOpen(true);
    void loadAvailableTagNames();
  };

  const handleConfirmAddTag = async () => {
    if (!addTagTarget || addTagSaving) {
      return;
    }

    const pendingInput = addTagInput.trim();
    const finalTagNames =
      pendingInput.length > 0
        ? Array.from(
            new Map(
              [...addTagDraft, pendingInput]
                .map((name) => name.trim())
                .filter((name) => name.length > 0)
                .map((name) => [name.toLocaleLowerCase(), name] as const)
            ).values()
          )
        : addTagDraft;
    const currentTagNames = Array.from(
      new Map(
        (addTagTarget.tags ?? [])
          .map((tag) => tag.name.trim())
          .filter((name) => name.length > 0)
          .map((name) => [name.toLocaleLowerCase(), name] as const)
      ).values()
    );
    const currentSet = new Set(currentTagNames.map((name) => name.toLocaleLowerCase()));
    const finalSet = new Set(finalTagNames.map((name) => name.toLocaleLowerCase()));
    const tagsToAdd = finalTagNames.filter((name) => !currentSet.has(name.toLocaleLowerCase()));
    const tagsToRemove = currentTagNames.filter((name) => !finalSet.has(name.toLocaleLowerCase()));

    setAddTagSaving(true);
    setAddTagError(null);
    try {
      for (const tagName of tagsToAdd) {
        await ipcInvoke('tag.addToManga', { mangaId: addTagTarget.id, tagName });
      }
      for (const tagName of tagsToRemove) {
        await ipcInvoke('tag.removeFromManga', { mangaId: addTagTarget.id, tagName });
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('manga-book-tags-updated'));
      }
      await refreshMangas();
      closeAddTagDialog(true);
    } catch (error) {
      const message = getErrorMessage(error, '添加标签失败');
      if (message.includes('No handler registered for') && message.includes('tag.')) {
        setAddTagError('当前 Electron 主进程尚未加载标签功能，请重启 bun run dev 后再试。');
        return;
      }
      setAddTagError(message);
    } finally {
      setAddTagSaving(false);
    }
  };

  const handleOpenInFolder = async (mangaId: string) => {
    setMoveError(null);
    try {
      await ipcInvoke('organizer.openMangaFolder', { mangaId });
    } catch (error) {
      setMoveError(getErrorMessage(error, '打开文件夹失败'));
    }
  };

  const handleSearchWeb = async (item: MangaBookWithCover, provider: 'hitomi' | 'exhentai' | 'google') => {
    if (!hasIpcBridge) {
      setMoveError('当前运行在普通浏览器环境，无法发起搜索。请使用 bun run dev 启动 Electron 窗口。');
      return;
    }

    const query = item.title.trim();
    if (!query) {
      setMoveError('当前漫画标题为空，无法发起搜索。');
      return;
    }

    setMoveError(null);
    try {
      await ipcInvoke('organizer.searchWeb', { provider, query });
    } catch (error) {
      setMoveError(getErrorMessage(error, '打开搜索失败'));
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
      await refreshMangas();
      closeDeleteDialog(true);
    } catch (error) {
      setMoveError(getErrorMessage(error, '删除漫画失败'));
    } finally {
      setDeleting(false);
    }
  };

  return {
    moving,
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
    handleConfirmDeleteManga
  };
}
