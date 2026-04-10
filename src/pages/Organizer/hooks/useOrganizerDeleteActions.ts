import { useMangaDeleteAction } from '@renderer/hooks/manga/useMangaDeleteAction';

interface UseOrganizerDeleteActionsInput {
  removeMangaLocal: (mangaId: string) => void;
  setMoveError: (message: string | null) => void;
  setSelectedIds: (updater: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
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
