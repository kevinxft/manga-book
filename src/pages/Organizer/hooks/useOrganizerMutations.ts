import type { Dispatch, SetStateAction } from 'react';
import type { DirectoryAlias, MangaBookWithCover } from '@shared/types';
import type { OrganizerCategory } from '../types';
import { useAliasMutations } from './useAliasMutations';
import { useAuthorDirectoryRename } from './useAuthorDirectoryRename';
import { useCreateAuthorMutation } from './useCreateAuthorMutation';
import { useMangaMutations } from './useMangaMutations';
import { useOrganizerMutationErrors } from './useOrganizerMutationErrors';

interface UseOrganizerMutationsArgs {
  hasIpcBridge: boolean;
  fetchMangas: () => Promise<void>;
  categories: OrganizerCategory[];
  aliases: DirectoryAlias[];
  selectedCategoryKey: string | null;
  selectedIds: Set<string>;
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>;
  setSelectedCategoryKey: (value: string | null) => void;
  removeMangaLocal: (mangaId: string) => void;
  refreshOrganizerMetadata: () => Promise<void>;
  refreshAuthorDirectories: () => Promise<void>;
  updateMangaLocal: (mangaId: string, updater: (manga: MangaBookWithCover) => MangaBookWithCover | null) => void;
  upsertAlias: (alias: DirectoryAlias) => void;
  removeAliasLocal: (aliasName: string) => void;
  addAuthorDirectoryLocal: (directoryPath: string) => void;
}

export function useOrganizerMutations({
  hasIpcBridge,
  fetchMangas,
  categories,
  aliases,
  selectedCategoryKey,
  selectedIds,
  setSelectedIds,
  setSelectedCategoryKey,
  removeMangaLocal,
  refreshOrganizerMetadata,
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

  const authorDirectoryRename = useAuthorDirectoryRename({
    hasIpcBridge,
    fetchMangas,
    refreshOrganizerMetadata,
    setSelectedCategoryKey,
    setMoveError
  });

  return {
    ...mangaMutations,
    ...aliasMutations,
    ...createAuthorMutation,
    ...authorDirectoryRename,
    moveError,
    setMoveError
  };
}
