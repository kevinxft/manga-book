import type { MangaBookWithCover } from '@shared/types';
import { useMangaTagEditor } from '@renderer/hooks/manga/useMangaTagEditor';

interface UseOrganizerTagActionsInput {
  hasIpcBridge: boolean;
  updateMangaLocal: (mangaId: string, updater: (manga: MangaBookWithCover) => MangaBookWithCover | null) => void;
  setMoveError: (message: string | null) => void;
}

export function useOrganizerTagActions({ hasIpcBridge, updateMangaLocal, setMoveError }: UseOrganizerTagActionsInput) {
  const tagEditor = useMangaTagEditor({
    hasIpcBridge,
    updateMangaLocal,
    setError: setMoveError
  });

  return {
    ...tagEditor,
    handleAddTagManga: tagEditor.openAddTagDialog
  };
}
