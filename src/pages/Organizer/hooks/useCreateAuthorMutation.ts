import { useState } from 'react';
import { ipcInvoke } from '@renderer/ipc/client';
import { useOrganizerSelectionStore } from '@renderer/stores/organizerSelectionStore';
import type { OrganizerCategory } from '../types';
import { getErrorMessage } from './error';

interface UseCreateAuthorMutationArgs {
  hasIpcBridge: boolean;
  categories: OrganizerCategory[];
  setSelectedCategoryKey: (value: string | null) => void;
  addAuthorDirectoryLocal: (directoryPath: string) => void;
  setMoveError: (message: string | null) => void;
}

export function useCreateAuthorMutation({
  hasIpcBridge,
  categories,
  setSelectedCategoryKey,
  addAuthorDirectoryLocal,
  setMoveError
}: UseCreateAuthorMutationArgs) {
  const [createAuthorDialogOpen, setCreateAuthorDialogOpen] = useState(false);
  const [creatingAuthor, setCreatingAuthor] = useState(false);
  const [createAuthorError, setCreateAuthorError] = useState<string | null>(null);

  const closeCreateAuthorDialog = (force = false) => {
    if (creatingAuthor && !force) {
      return;
    }
    setCreateAuthorDialogOpen(false);
    setCreateAuthorError(null);
  };

  const handleRequestCreateAuthor = () => {
    setMoveError(null);
    setCreateAuthorError(null);
    setCreateAuthorDialogOpen(true);
  };

  const handleConfirmCreateAuthor = async (nextAuthorName: string) => {
    if (!hasIpcBridge || creatingAuthor) {
      return;
    }

    const trimmed = nextAuthorName.trim();
    if (!trimmed) {
      setCreateAuthorError('请输入作者名称');
      return;
    }

    setCreatingAuthor(true);
    setCreateAuthorError(null);
    setMoveError(null);
    try {
      const { selectedCategoryKey } = useOrganizerSelectionStore.getState();
      const selectedCategory = categories.find((item) => item.key === selectedCategoryKey) ?? null;
      const result = await ipcInvoke('organizer.createAuthorDirectory', {
        name: trimmed,
        basePath: selectedCategory?.path
      });
      addAuthorDirectoryLocal(result.path);
      setSelectedCategoryKey(`artists:${result.path}`);
      closeCreateAuthorDialog(true);
      if (!result.created) {
        setMoveError('作者目录已存在，已自动定位。');
      }
    } catch (error) {
      const rawMessage = getErrorMessage(error, '新建作者失败');
      const message = rawMessage.includes("No handler registered for 'organizer.createAuthorDirectory'")
        ? '当前 Electron 主进程还没加载新建作者功能，请重启 bun run dev 后再试。'
        : rawMessage;
      setCreateAuthorError(message);
      setMoveError(message);
    } finally {
      setCreatingAuthor(false);
    }
  };

  return {
    createAuthorDialogOpen,
    creatingAuthor,
    createAuthorError,
    closeCreateAuthorDialog,
    handleRequestCreateAuthor,
    handleConfirmCreateAuthor
  };
}
