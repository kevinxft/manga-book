import type { MangaBookWithCover } from '@shared/types';
import type { OrganizerCategory } from '../types';
import { useOrganizerDeleteActions } from './useOrganizerDeleteActions';
import { useOrganizerMoveActions } from './useOrganizerMoveActions';
import { useOrganizerSearchActions } from './useOrganizerSearchActions';
import { useOrganizerTagActions } from './useOrganizerTagActions';

interface UseMangaMutationsArgs {
  hasIpcBridge: boolean;
  categories: OrganizerCategory[];
  setSelectedIds: (updater: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  removeMangaLocal: (mangaId: string) => void;
  updateMangaLocal: (mangaId: string, updater: (manga: MangaBookWithCover) => MangaBookWithCover | null) => void;
  refreshAuthorDirectories: () => Promise<void>;
  setMoveError: (message: string | null) => void;
}

export function useMangaMutations({
  hasIpcBridge,
  categories,
  setSelectedIds,
  removeMangaLocal,
  updateMangaLocal,
  refreshAuthorDirectories,
  setMoveError
}: UseMangaMutationsArgs) {
  const moveActions = useOrganizerMoveActions({
    hasIpcBridge,
    categories,
    setSelectedIds,
    updateMangaLocal,
    refreshAuthorDirectories,
    setMoveError
  });

  const deleteActions = useOrganizerDeleteActions({
    removeMangaLocal,
    setMoveError,
    setSelectedIds
  });

  const tagActions = useOrganizerTagActions({
    hasIpcBridge,
    updateMangaLocal,
    setMoveError
  });

  const searchActions = useOrganizerSearchActions({
    hasIpcBridge,
    setMoveError
  });

  return {
    ...moveActions,
    ...tagActions,
    ...searchActions,
    ...deleteActions
  };
}
