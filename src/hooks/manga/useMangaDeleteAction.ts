import { useState } from 'react';
import type { MangaBookWithCover } from '@shared/types';
import { ipcInvoke } from '@renderer/ipc/client';

interface UseMangaDeleteActionInput {
  removeMangaLocal: (mangaId: string) => void;
  setError: (message: string | null) => void;
  onDeleted?: (mangaId: string) => void;
}

export function useMangaDeleteAction({ removeMangaLocal, setError, onDeleted }: UseMangaDeleteActionInput) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MangaBookWithCover | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleRequestDeleteManga = (item: MangaBookWithCover) => {
    setError(null);
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
    setError(null);
    try {
      await ipcInvoke('organizer.deleteManga', { mangaId: deleteTarget.id, withFiles: true });
      onDeleted?.(deleteTarget.id);
      removeMangaLocal(deleteTarget.id);
      closeDeleteDialog(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : '删除漫画失败');
    } finally {
      setDeleting(false);
    }
  };

  return {
    deleteDialogOpen,
    deleteTarget,
    deleting,
    handleRequestDeleteManga,
    closeDeleteDialog,
    handleConfirmDeleteManga
  };
}
