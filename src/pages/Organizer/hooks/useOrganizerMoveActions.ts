import type { Dispatch, SetStateAction } from 'react';
import { useState } from 'react';
import type { MangaBookWithCover } from '@shared/types';
import { useMangaRenameAction } from '@renderer/hooks/manga/useMangaRenameAction';
import { ipcInvoke } from '@renderer/ipc/client';
import { mergeMangaWithBase } from '@renderer/lib/manga';
import type { OrganizerCategory } from '../types';
import { getErrorMessage } from './error';

interface UseOrganizerMoveActionsInput {
  hasIpcBridge: boolean;
  categories: OrganizerCategory[];
  selectedCategoryKey: string | null;
  selectedIds: Set<string>;
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>;
  updateMangaLocal: (mangaId: string, updater: (manga: MangaBookWithCover) => MangaBookWithCover | null) => void;
  refreshAuthorDirectories: () => Promise<void>;
  setMoveError: (message: string | null) => void;
}

export function useOrganizerMoveActions({
  hasIpcBridge,
  categories,
  selectedCategoryKey,
  selectedIds,
  setSelectedIds,
  updateMangaLocal,
  refreshAuthorDirectories,
  setMoveError
}: UseOrganizerMoveActionsInput) {
  const [moving, setMoving] = useState(false);
  const {
    renameDialogOpen,
    renameTarget,
    renameInput,
    renaming,
    setRenameInput,
    handleRequestRenameManga,
    closeRenameDialog,
    handleConfirmRenameManga
  } = useMangaRenameAction({
    hasIpcBridge,
    updateMangaLocal,
    setError: setMoveError
  });

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
      const renamedTitles: string[] = [];
      let firstErrorMessage: string | null = null;

      for (const mangaId of targets) {
        try {
          const result = await ipcInvoke('organizer.moveManga', {
            mangaId,
            destinationPath: selectedCategory.path
          });
          updateMangaLocal(mangaId, (current) => mergeMangaWithBase(current, result.manga));
          if (result.renamedDueToConflict) {
            renamedTitles.push(result.manga.title);
          }
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
        await refreshAuthorDirectories();
      }

      if (firstErrorMessage) {
        const failedCount = targets.length - movedIds.length;
        if (movedIds.length > 0) {
          setMoveError(`已移动 ${movedIds.length} 本，${failedCount} 本失败：${firstErrorMessage}`);
        } else {
          setMoveError(firstErrorMessage);
        }
      } else if (renamedTitles.length > 0) {
        const preview = renamedTitles.slice(0, 2).join('、');
        const suffix = renamedTitles.length > 2 ? ` 等 ${renamedTitles.length} 本` : '';
        setMoveError(`检测到同名漫画，已自动重命名后移动：${preview}${suffix}`);
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
      const result = await ipcInvoke('organizer.moveManga', { mangaId, destinationPath });
      updateMangaLocal(mangaId, (current) => mergeMangaWithBase(current, result.manga));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(mangaId);
        return next;
      });
      await refreshAuthorDirectories();
      if (result.renamedDueToConflict) {
        setMoveError(`检测到同名漫画，已自动重命名为「${result.manga.title}」后移动。`);
      }
    } catch (error) {
      setMoveError(getErrorMessage(error, '快速移动失败'));
    }
  };

  return {
    moving,
    handleMoveSelected,
    handleQuickMoveSingle,
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
