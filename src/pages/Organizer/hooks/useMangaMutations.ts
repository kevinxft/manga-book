import type { Dispatch, SetStateAction } from 'react';
import type { OrganizerCategory } from '../types';
import { useOrganizerDeleteActions } from './useOrganizerDeleteActions';
import { useOrganizerMoveActions } from './useOrganizerMoveActions';
import { useOrganizerSearchActions } from './useOrganizerSearchActions';
import { useOrganizerTagActions } from './useOrganizerTagActions';

interface UseMangaMutationsArgs {
  hasIpcBridge: boolean;
  categories: OrganizerCategory[];
  selectedCategoryKey: string | null;
  selectedIds: Set<string>;
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>;
  refreshMangas: () => Promise<void>;
  setMoveError: (message: string | null) => void;
}

export function useMangaMutations({
  hasIpcBridge,
  categories,
  selectedCategoryKey,
  selectedIds,
  setSelectedIds,
  refreshMangas,
  setMoveError
}: UseMangaMutationsArgs) {
  const moveActions = useOrganizerMoveActions({
    hasIpcBridge,
    categories,
    selectedCategoryKey,
    selectedIds,
    setSelectedIds,
    refreshMangas,
    setMoveError
  });

  const deleteActions = useOrganizerDeleteActions({
    refreshMangas,
    setMoveError,
    setSelectedIds
  });

  const tagActions = useOrganizerTagActions({
    hasIpcBridge,
    refreshMangas,
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
