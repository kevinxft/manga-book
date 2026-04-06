import { useEffect, useState } from 'react';
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
  const [renameInput, setRenameInput] = useState('');
  const [renaming, setRenaming] = useState(false);

  useEffect(() => {
    if (!renameDialogOpen) {
      setRenameInput('');
      setRenaming(false);
    }
  }, [renameDialogOpen]);

  const handleRequestRenameManga = (item: MangaBookWithCover) => {
    setRenameTarget(item);
    setRenameInput(item.title);
    setRenameDialogOpen(true);
  };

  const closeRenameDialog = () => {
    if (renaming) {
      return;
    }
    setRenameDialogOpen(false);
    setRenameTarget(null);
  };

  const handleConfirmRenameManga = async () => {
    if (!hasIpcBridge || !renameTarget || renaming) {
      return;
    }

    const trimmed = renameInput.trim();
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
      setRenaming(false);
    }
  };

  return {
    renameDialogOpen,
    renameTarget,
    renameInput,
    renaming,
    setRenameInput,
    handleRequestRenameManga,
    closeRenameDialog,
    handleConfirmRenameManga
  };
}
