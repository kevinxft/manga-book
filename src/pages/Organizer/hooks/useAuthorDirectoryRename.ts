import { useState } from 'react';
import { ipcInvoke } from '@renderer/ipc/client';
import { useLibraryStore } from '@renderer/stores/libraryStore';
import { useOrganizerMetadataStore } from '@renderer/stores/organizerMetadataStore';
import type { OrganizerCategory } from '../types';

interface UseAuthorDirectoryRenameArgs {
  hasIpcBridge: boolean;
  setSelectedCategoryKey: (value: string | null) => void;
  setMoveError: (message: string | null) => void;
  buildCategoryKey?: (directoryPath: string) => string | null;
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

export function useAuthorDirectoryRename({
  hasIpcBridge,
  setSelectedCategoryKey,
  setMoveError,
  buildCategoryKey
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

      useLibraryStore.getState().updateAllMangasLocal((manga) => {
        const nextFolderPath = replacePathPrefix(manga.folderPath, result.previousPath, result.path);
        const nextCoverPath = manga.coverPath
          ? replacePathPrefix(manga.coverPath, result.previousPath, result.path)
          : manga.coverPath;

        if (nextFolderPath === manga.folderPath && nextCoverPath === manga.coverPath) {
          return manga;
        }

        return {
          ...manga,
          folderPath: nextFolderPath,
          coverPath: nextCoverPath
        };
      });
      useOrganizerMetadataStore.getState().renameAuthorDirectoryLocal(result);
      setSelectedCategoryKey(buildCategoryKey ? buildCategoryKey(result.path) : `artists:${result.path}`);
      setRenameAuthorDialogOpen(false);
      setRenameAuthorTarget(null);
    } catch (error) {
      setMoveError(error instanceof Error ? error.message : '作者目录重命名失败');
    } finally {
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
