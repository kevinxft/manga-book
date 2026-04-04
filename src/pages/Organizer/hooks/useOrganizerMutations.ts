import type { Dispatch, SetStateAction } from 'react';
import type { DirectoryAlias, MangaBookWithCover } from '@shared/types';
import type { OrganizerCategory } from '../types';
import { useAliasMutations } from './useAliasMutations';
import { useCreateAuthorMutation } from './useCreateAuthorMutation';
import { useMangaMutations } from './useMangaMutations';
import { useOrganizerMutationErrors } from './useOrganizerMutationErrors';

interface UseOrganizerMutationsArgs {
  hasIpcBridge: boolean;
  categories: OrganizerCategory[];
  aliases: DirectoryAlias[];
  selectedCategoryKey: string | null;
  selectedIds: Set<string>;
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>;
  setSelectedCategoryKey: (value: string | null) => void;
  removeMangaLocal: (mangaId: string) => void;
  refreshAuthorDirectories: () => Promise<void>;
  updateMangaLocal: (mangaId: string, updater: (manga: MangaBookWithCover) => MangaBookWithCover | null) => void;
  upsertAlias: (alias: DirectoryAlias) => void;
  removeAliasLocal: (aliasName: string) => void;
  addAuthorDirectoryLocal: (directoryPath: string) => void;
}

export function useOrganizerMutations({
  hasIpcBridge,
  categories,
  aliases,
  selectedCategoryKey,
  selectedIds,
  setSelectedIds,
  setSelectedCategoryKey,
  removeMangaLocal,
  refreshAuthorDirectories,
  updateMangaLocal,
  upsertAlias,
  removeAliasLocal,
  addAuthorDirectoryLocal
}: UseOrganizerMutationsArgs) {
  const { moveError, setMoveError } = useOrganizerMutationErrors();

  const mangaMutations = useMangaMutations({
    hasIpcBridge,
    categories,
    selectedCategoryKey,
    selectedIds,
    setSelectedIds,
    removeMangaLocal,
    updateMangaLocal,
    refreshAuthorDirectories,
    setMoveError
  });

  const aliasMutations = useAliasMutations({
    aliases,
    upsertAlias,
    removeAliasLocal,
    setMoveError
  });

  const createAuthorMutation = useCreateAuthorMutation({
    hasIpcBridge,
    categories,
    selectedCategoryKey,
    setSelectedCategoryKey,
    addAuthorDirectoryLocal,
    setMoveError
  });

  return {
    ...mangaMutations,
    ...aliasMutations,
    ...createAuthorMutation,
    moveError,
    setMoveError
  };
}
