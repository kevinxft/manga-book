import { useState } from 'react';
import { ipcInvoke } from '@renderer/ipc/client';
import type { OrganizerCategory } from '../types';

interface UseAuthorDirectoryRenameArgs {
  hasIpcBridge: boolean;
  fetchMangas: () => Promise<void>;
  refreshOrganizerMetadata: () => Promise<void>;
  setSelectedCategoryKey: (value: string | null) => void;
  setMoveError: (message: string | null) => void;
}

export function useAuthorDirectoryRename({
  hasIpcBridge,
  fetchMangas,
  refreshOrganizerMetadata,
  setSelectedCategoryKey,
  setMoveError
}: UseAuthorDirectoryRenameArgs) {
  const [renameAuthorDialogOpen, setRenameAuthorDialogOpen] = useState(false);
  const [renameAuthorTarget, setRenameAuthorTarget] = useState<OrganizerCategory | null>(null);
  const [renamingAuthor, setRenamingAuthor] = useState(false);

  const handleRequestRenameAuthorDirectory = (category: OrganizerCategory) => {
    setRenameAuthorTarget(category);
    setRenameAuthorDialogOpen(true);
  };

  const closeRenameAuthorDialog = () => {
    if (renamingAuthor) {
      return;
    }
    setRenameAuthorDialogOpen(false);
    setRenameAuthorTarget(null);
  };

  const handleConfirmRenameAuthorDirectory = async (nextName: string) => {
    if (!hasIpcBridge || !renameAuthorTarget || renamingAuthor) {
      return;
    }

    const trimmed = nextName.trim();
    if (!trimmed || trimmed === renameAuthorTarget.label) {
      closeRenameAuthorDialog();
      return;
    }

    setRenamingAuthor(true);
    setMoveError(null);

    try {
      const result = await ipcInvoke('organizer.renameAuthorDirectory', {
        directoryPath: renameAuthorTarget.path,
        newName: trimmed
      });

      await Promise.all([fetchMangas(), refreshOrganizerMetadata()]);
      setSelectedCategoryKey(`artists:${result.path}`);
      setRenameAuthorDialogOpen(false);
      setRenameAuthorTarget(null);
    } catch (error) {
      setMoveError(error instanceof Error ? error.message : '作者目录重命名失败');
      setRenamingAuthor(false);
    }
  };

  return {
    renameAuthorDialogOpen,
    renameAuthorTarget,
    renamingAuthor,
    handleRequestRenameAuthorDirectory,
    closeRenameAuthorDialog,
    handleConfirmRenameAuthorDirectory
  };
}
