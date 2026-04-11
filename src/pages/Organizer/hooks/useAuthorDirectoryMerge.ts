import { useState } from 'react';
import { ipcInvoke } from '@renderer/ipc/client';
import { useLibraryStore } from '@renderer/stores/libraryStore';
import { useOrganizerMetadataStore } from '@renderer/stores/organizerMetadataStore';
import { getErrorMessage } from './error';

interface UseAuthorDirectoryMergeArgs {
  hasIpcBridge: boolean;
  setSelectedCategoryKey: (value: string | null) => void;
  setMoveError: (message: string | null) => void;
}

interface ConfirmMergeInput {
  sourceDirectoryPaths: string[];
  targetName: string;
}

function replacePathPrefix(value: string, previousPath: string, nextPath: string): string {
  if (value === previousPath) {
    return nextPath;
  }

  const slashPrefix = `${previousPath}/`;
  if (value.startsWith(slashPrefix)) {
    return `${nextPath}/${value.slice(slashPrefix.length)}`;
  }

  const backslashPrefix = `${previousPath}\\`;
  if (value.startsWith(backslashPrefix)) {
    return `${nextPath}\\${value.slice(backslashPrefix.length)}`;
  }

  return value;
}

export function useAuthorDirectoryMerge({ hasIpcBridge, setSelectedCategoryKey, setMoveError }: UseAuthorDirectoryMergeArgs) {
  const [mergeAuthorDialogOpen, setMergeAuthorDialogOpen] = useState(false);
  const [mergingAuthors, setMergingAuthors] = useState(false);
  const [mergeAuthorError, setMergeAuthorError] = useState<string | null>(null);

  const handleRequestMergeAuthorDirectories = () => {
    setMoveError(null);
    setMergeAuthorError(null);
    setMergeAuthorDialogOpen(true);
  };

  const closeMergeAuthorDialog = () => {
    if (mergingAuthors) {
      return;
    }
    setMergeAuthorDialogOpen(false);
    setMergeAuthorError(null);
  };

  const handleConfirmMergeAuthorDirectories = async ({ sourceDirectoryPaths, targetName }: ConfirmMergeInput) => {
    if (!hasIpcBridge || mergingAuthors) {
      return;
    }

    const trimmedTargetName = targetName.trim();
    if (sourceDirectoryPaths.length < 2) {
      setMergeAuthorError('请至少选择 2 个目录');
      return;
    }
    if (!trimmedTargetName) {
      setMergeAuthorError('请输入最终目录名');
      return;
    }

    setMergingAuthors(true);
    setMergeAuthorError(null);
    setMoveError(null);

    try {
      const result = await ipcInvoke('organizer.mergeAuthorDirectories', {
        sourceDirectoryPaths,
        targetName: trimmedTargetName
      });

      const movedMangaById = new Map(result.movedMangas.map((manga) => [manga.id, manga]));
      useLibraryStore.getState().updateAllMangasLocal((manga) => {
        const moved = movedMangaById.get(manga.id);
        if (!moved) {
          return manga;
        }

        return {
          ...manga,
          title: moved.title,
          folderPath: moved.path,
          coverPath: manga.coverPath ? replacePathPrefix(manga.coverPath, moved.previousPath, moved.path) : manga.coverPath
        };
      });

      useOrganizerMetadataStore.getState().mergeAuthorDirectoriesLocal(result);
      setSelectedCategoryKey(`artists:${result.targetPath}`);
      setMergeAuthorDialogOpen(false);
      if (result.renamedConflictCount > 0) {
        setMoveError(`检测到同名漫画，已自动重命名 ${result.renamedConflictCount} 个目录后合并。`);
      }
    } catch (error) {
      const message = getErrorMessage(error, '合并目录失败');
      setMergeAuthorError(message);
      setMoveError(message);
    } finally {
      setMergingAuthors(false);
    }
  };

  return {
    mergeAuthorDialogOpen,
    mergingAuthors,
    mergeAuthorError,
    handleRequestMergeAuthorDirectories,
    closeMergeAuthorDialog,
    handleConfirmMergeAuthorDirectories
  };
}
