import type { Dispatch, SetStateAction } from 'react';
import { useState } from 'react';
import type { MangaBookWithCover } from '@shared/types';
import { ipcInvoke } from '@renderer/ipc/client';
import type { OrganizerCategory } from '../types';
import { getErrorMessage } from './error';

interface UseOrganizerMoveActionsInput {
  hasIpcBridge: boolean;
  categories: OrganizerCategory[];
  selectedCategoryKey: string | null;
  selectedIds: Set<string>;
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>;
  refreshMangas: () => Promise<void>;
  refreshAuthorDirectories: () => Promise<void>;
  setMoveError: (message: string | null) => void;
}

export function useOrganizerMoveActions({
  hasIpcBridge,
  categories,
  selectedCategoryKey,
  selectedIds,
  setSelectedIds,
  refreshMangas,
  refreshAuthorDirectories,
  setMoveError
}: UseOrganizerMoveActionsInput) {
  const [moving, setMoving] = useState(false);

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
        await Promise.all([refreshMangas(), refreshAuthorDirectories()]);
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
      await Promise.all([refreshMangas(), refreshAuthorDirectories()]);
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

  return {
    moving,
    handleMoveSelected,
    handleQuickMoveSingle,
    handleRenameSingle
  };
}
