import { useState } from 'react';
import type { MangaBookWithCover } from '@shared/types';
import { ipcInvoke } from '@renderer/ipc/client';

interface UseLibraryMangaActionsInput {
  hasIpcBridge: boolean;
  refreshCurrentList: () => Promise<void>;
}

export function useLibraryMangaActions({ hasIpcBridge, refreshCurrentList }: UseLibraryMangaActionsInput) {
  const [operationError, setOperationError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MangaBookWithCover | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleQuickMoveManga = async (mangaId: string, destinationPath: string) => {
    if (!hasIpcBridge) {
      return;
    }
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

  const handleOpenInFolder = async (mangaId: string) => {
    setOperationError(null);
    try {
      await ipcInvoke('organizer.openMangaFolder', { mangaId });
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : '打开文件夹失败');
    }
  };

  const handleSearchWeb = async (item: MangaBookWithCover, provider: 'hitomi' | 'exhentai' | 'google') => {
    if (!hasIpcBridge) {
      setOperationError('当前运行在普通浏览器环境，无法发起搜索。请使用 bun run dev 启动 Electron 窗口。');
      return;
    }

    const query = item.title.trim();
    if (!query) {
      setOperationError('当前漫画标题为空，无法发起搜索。');
      return;
    }

    setOperationError(null);
    try {
      await ipcInvoke('organizer.searchWeb', { provider, query });
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : '打开搜索失败');
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

  return {
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
  };
}
