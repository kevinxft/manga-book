import type { Dispatch, SetStateAction } from 'react';
import { useMangaDeleteAction } from '@renderer/hooks/manga/useMangaDeleteAction';

interface UseOrganizerDeleteActionsInput {
  removeMangaLocal: (mangaId: string) => void;
  setMoveError: (message: string | null) => void;
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>;
}

export function useOrganizerDeleteActions({
  removeMangaLocal,
  setMoveError,
  setSelectedIds
}: UseOrganizerDeleteActionsInput) {
  return useMangaDeleteAction({
    removeMangaLocal,
    setError: setMoveError,
    onDeleted: (mangaId) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(mangaId);
        return next;
      });
    }
  });
}
