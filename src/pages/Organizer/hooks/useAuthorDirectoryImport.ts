import { useState } from 'react';
import { ipcInvoke } from '@renderer/ipc/client';
import type { OrganizerCategory } from '../types';

interface UseAuthorDirectoryImportArgs {
  hasIpcBridge: boolean;
  fetchMangas: () => Promise<void>;
  refreshAuthorDirectories: () => Promise<void>;
  setMoveError: (message: string | null) => void;
}

export function useAuthorDirectoryImport({
  hasIpcBridge,
  fetchMangas,
  refreshAuthorDirectories,
  setMoveError
}: UseAuthorDirectoryImportArgs) {
  const [importingAuthorDirectoryPath, setImportingAuthorDirectoryPath] = useState<string | null>(null);

  const handleRequestImportToAuthorDirectory = async (category: OrganizerCategory) => {
    if (!hasIpcBridge || importingAuthorDirectoryPath) {
      return;
    }

    setImportingAuthorDirectoryPath(category.path);
    setMoveError(null);

    try {
      const result = await ipcInvoke('organizer.importMangasToAuthorDirectory', {
        directoryPath: category.path
      });

      if (result.cancelled) {
        return;
      }

      await Promise.all([fetchMangas(), refreshAuthorDirectories()]);

      if (result.renamedConflictCount > 0 || result.skipped.length > 0) {
        const details = [`已导入 ${result.importedCount} 本漫画`];
        if (result.renamedConflictCount > 0) {
          details.push(`${result.renamedConflictCount} 本因同名自动重命名`);
        }
        if (result.skipped.length > 0) {
          details.push(`${result.skipped.length} 个目录未导入`);
        }
        setMoveError(`${details.join('，')}。`);
      }
    } catch (error) {
      setMoveError(error instanceof Error ? error.message : '导入漫画失败');
    } finally {
      setImportingAuthorDirectoryPath(null);
    }
  };

  return {
    importingAuthorDirectoryPath,
    handleRequestImportToAuthorDirectory
  };
}
