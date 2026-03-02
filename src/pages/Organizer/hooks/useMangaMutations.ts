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

  const handleAddTagManga = async (item: MangaBookWithCover) => {
    if (!hasIpcBridge) {
      setMoveError('当前运行在普通浏览器环境，无法添加标签。请使用 bun run dev 启动 Electron 窗口。');
      return;
    }

    const tagName = window.prompt('请输入标签名称', '');
    const trimmed = tagName?.trim();
    if (!trimmed) {
      return;
    }

    setMoveError(null);
    try {
      const result = await ipcInvoke('tag.addToManga', { mangaId: item.id, tagName: trimmed });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('manga-book-tags-updated'));
        window.alert(result.linked ? `已添加标签：${result.tag.name}` : `该漫画已存在标签：${result.tag.name}`);
      }
    } catch (error) {
      const message = getErrorMessage(error, '添加标签失败');
      if (message.includes('No handler registered for') && message.includes('tag.')) {
        setMoveError('当前 Electron 主进程尚未加载标签功能，请重启 bun run dev 后再试。');
        return;
      }
      setMoveError(message);
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
    handleRenameSingle,
    handleOpenInFolder,
    deleteDialogOpen,
    deleteTarget,
    deleting,
    handleRequestDeleteManga,
    closeDeleteDialog,
    handleConfirmDeleteManga
  };
}
