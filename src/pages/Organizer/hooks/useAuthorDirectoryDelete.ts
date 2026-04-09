import { useState } from 'react';
import { ipcInvoke } from '@renderer/ipc/client';
import type { OrganizerCategory } from '../types';

interface UseAuthorDirectoryDeleteArgs {
  hasIpcBridge: boolean;
  fetchMangas: () => Promise<void>;
  refreshOrganizerMetadata: () => Promise<void>;
  setSelectedCategoryKey: (value: string | null) => void;
  setMoveError: (message: string | null) => void;
  nextSelectedCategoryKey?: string | null;
}

export function useAuthorDirectoryDelete({
  hasIpcBridge,
  fetchMangas,
  refreshOrganizerMetadata,
  setSelectedCategoryKey,
  setMoveError,
  nextSelectedCategoryKey = null
}: UseAuthorDirectoryDeleteArgs) {
  const [deleteAuthorDialogOpen, setDeleteAuthorDialogOpen] = useState(false);
  const [deleteAuthorTarget, setDeleteAuthorTarget] = useState<OrganizerCategory | null>(null);
  const [deletingAuthor, setDeletingAuthor] = useState(false);
  const [deleteAuthorError, setDeleteAuthorError] = useState<string | null>(null);

  const handleRequestDeleteAuthorDirectory = (category: OrganizerCategory) => {
    setMoveError(null);
    setDeleteAuthorError(null);
    setDeleteAuthorTarget(category);
    setDeleteAuthorDialogOpen(true);
  };

  const closeDeleteAuthorDialog = (force = false) => {
    if (deletingAuthor && !force) {
      return;
    }
    setDeleteAuthorDialogOpen(false);
    setDeleteAuthorTarget(null);
    setDeleteAuthorError(null);
  };

  const handleConfirmDeleteAuthorDirectory = async () => {
    if (!hasIpcBridge || !deleteAuthorTarget || deletingAuthor) {
      return;
    }

    if (deleteAuthorTarget.count > 0) {
      const message = '该作者目录下还有漫画，不能删除。';
      setDeleteAuthorError(message);
      setMoveError(message);
      return;
    }

    setDeletingAuthor(true);
    setDeleteAuthorError(null);
    setMoveError(null);

    try {
      await ipcInvoke('organizer.deleteAuthorDirectory', {
        directoryPath: deleteAuthorTarget.path
      });

      setSelectedCategoryKey(nextSelectedCategoryKey);
      await Promise.all([fetchMangas(), refreshOrganizerMetadata()]);
      closeDeleteAuthorDialog(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : '作者目录删除失败';
      setDeleteAuthorError(message);
      setMoveError(message);
    } finally {
      setDeletingAuthor(false);
    }
  };

  return {
    deleteAuthorDialogOpen,
    deleteAuthorTarget,
    deletingAuthor,
    deleteAuthorError,
    handleRequestDeleteAuthorDirectory,
    closeDeleteAuthorDialog,
    handleConfirmDeleteAuthorDirectory
  };
}
