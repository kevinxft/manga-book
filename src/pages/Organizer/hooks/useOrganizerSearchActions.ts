import { useMangaSearchActions } from '@renderer/hooks/manga/useMangaSearchActions';

interface UseOrganizerSearchActionsInput {
  hasIpcBridge: boolean;
  setMoveError: (message: string | null) => void;
}

export function useOrganizerSearchActions({ hasIpcBridge, setMoveError }: UseOrganizerSearchActionsInput) {
  return useMangaSearchActions({
    hasIpcBridge,
    setError: setMoveError
  });
}
