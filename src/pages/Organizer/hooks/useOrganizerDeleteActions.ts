import type { Dispatch, SetStateAction } from 'react';
import { useState } from 'react';
import type { MangaBookWithCover } from '@shared/types';
import { ipcInvoke } from '@renderer/ipc/client';
import { getErrorMessage } from './error';

interface UseOrganizerDeleteActionsInput {
  removeMangaLocal: (mangaId: string) => void;
  setMoveError: (message: string | null) => void;
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>;
}

export function useOrganizerDeleteActions({
  removeMangaLocal,
  setMoveError,
  setSelectedIds
}: UseOrganizerDeleteActionsInput) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MangaBookWithCover | null>(null);
  const [deleting, setDeleting] = useState(false);

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
      removeMangaLocal(deleteTarget.id);
      closeDeleteDialog(true);
    } catch (error) {
      setMoveError(getErrorMessage(error, '删除漫画失败'));
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
