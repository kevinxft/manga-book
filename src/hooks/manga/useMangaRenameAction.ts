import type { MangaBookWithCover } from '@shared/types';
import { ipcInvoke } from '@renderer/ipc/client';
import { mergeMangaWithBase } from '@renderer/lib/manga';

interface UseMangaRenameActionInput {
  updateMangaLocal: (mangaId: string, updater: (manga: MangaBookWithCover) => MangaBookWithCover | null) => void;
  setError: (message: string | null) => void;
}

export function useMangaRenameAction({ updateMangaLocal, setError }: UseMangaRenameActionInput) {
  const handleRenameManga = async (item: MangaBookWithCover) => {
    const nextTitle = window.prompt('请输入新的漫画名称', item.title);
    const trimmed = nextTitle?.trim();
    if (!trimmed || trimmed === item.title) {
      return;
    }

    setError(null);
    try {
      const updated = await ipcInvoke('organizer.renameManga', {
        mangaId: item.id,
        newTitle: trimmed
      });
      updateMangaLocal(item.id, (current) => mergeMangaWithBase(current, updated));
    } catch (error) {
      setError(error instanceof Error ? error.message : '重命名失败');
    }
  };

  return {
    handleRenameManga
  };
}
