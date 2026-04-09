import { useState } from 'react';
import type { MangaBookWithCover } from '@shared/types';
import { ipcInvoke } from '@renderer/ipc/client';
import { useMangaDeleteAction } from '@renderer/hooks/manga/useMangaDeleteAction';
import { useMangaRenameAction } from '@renderer/hooks/manga/useMangaRenameAction';
import { useMangaSearchActions } from '@renderer/hooks/manga/useMangaSearchActions';
import { mergeMangaWithBase } from '@renderer/lib/manga';

interface UseLibraryMangaActionsInput {
  hasIpcBridge: boolean;
  updateMangaLocal: (mangaId: string, updater: (manga: MangaBookWithCover) => MangaBookWithCover | null) => void;
  removeMangaLocal: (mangaId: string) => void;
}

export function useLibraryMangaActions({ hasIpcBridge, updateMangaLocal, removeMangaLocal }: UseLibraryMangaActionsInput) {
  const [operationError, setOperationError] = useState<string | null>(null);
  const {
    renameDialogOpen,
    renameTarget,
    renaming,
    handleRequestRenameManga,
    closeRenameDialog,
    handleConfirmRenameManga
  } = useMangaRenameAction({
    hasIpcBridge,
    updateMangaLocal,
    setError: setOperationError
  });
  const { handleOpenInFolder, handleSearchWeb } = useMangaSearchActions({
    hasIpcBridge,
    setError: setOperationError
  });
  const {
    deleteDialogOpen,
    deleteTarget,
    deleting,
    handleRequestDeleteManga,
    closeDeleteDialog,
    handleConfirmDeleteManga
  } = useMangaDeleteAction({
    removeMangaLocal,
    setError: setOperationError
  });

  const handleQuickMoveManga = async (mangaId: string, destinationPath: string) => {
    if (!hasIpcBridge) {
      return;
    }
    setOperationError(null);
    try {
      const result = await ipcInvoke('organizer.moveManga', { mangaId, destinationPath });
      updateMangaLocal(mangaId, (current) => mergeMangaWithBase(current, result.manga));
      if (result.renamedDueToConflict) {
        setOperationError(`检测到同名漫画，已自动重命名为「${result.manga.title}」后移动。`);
      }
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : '快速移动失败');
    }
  };

  return {
    operationError,
    setOperationError,
    handleQuickMoveManga,
    renameDialogOpen,
    renameTarget,
    renaming,
    handleRequestRenameManga,
    closeRenameDialog,
    handleConfirmRenameManga,
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
