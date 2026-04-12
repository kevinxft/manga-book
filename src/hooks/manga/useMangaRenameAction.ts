import { useState } from 'react';
import type { MangaBookWithCover } from '@shared/types';
import { ipcInvoke } from '@renderer/ipc/client';
import { mergeMangaWithBase } from '@renderer/lib/manga';

interface UseMangaRenameActionInput {
  hasIpcBridge: boolean;
  updateMangaLocal: (mangaId: string, updater: (manga: MangaBookWithCover) => MangaBookWithCover | null) => void;
  setError: (message: string | null) => void;
}

export function useMangaRenameAction({ hasIpcBridge, updateMangaLocal, setError }: UseMangaRenameActionInput) {
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<MangaBookWithCover | null>(null);
  const [renaming, setRenaming] = useState(false);

  const handleRequestRenameManga = (item: MangaBookWithCover) => {
    setRenameTarget(item);
    setRenameDialogOpen(true);
  };

  const closeRenameDialog = () => {
    if (renaming) {
      return;
    }
    setRenameDialogOpen(false);
    setRenameTarget(null);
  };

  const handleConfirmRenameManga = async (nextTitle: string) => {
    if (!hasIpcBridge || !renameTarget || renaming) {
      return;
    }

    const trimmed = nextTitle.trim();
    if (!trimmed || trimmed === renameTarget.title) {
      closeRenameDialog();
      return;
    }

    setRenaming(true);
    setError(null);
    try {
      const updated = await ipcInvoke('organizer.renameManga', {
        mangaId: renameTarget.id,
        newTitle: trimmed
      });
      updateMangaLocal(renameTarget.id, (current) => mergeMangaWithBase(current, updated));
      setRenameDialogOpen(false);
      setRenameTarget(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : '重命名失败');
    } finally {
      setRenaming(false);
    }
  };

  return {
    renameDialogOpen,
    renameTarget,
    renaming,
    handleRequestRenameManga,
    closeRenameDialog,
    handleConfirmRenameManga
  };
}
