import type { DirectoryAlias, MangaBookWithCover } from '@shared/types';
import type { OrganizerCategory } from '../types';
import { useAliasMutations } from './useAliasMutations';
import { useAuthorDirectoryDelete } from './useAuthorDirectoryDelete';
import { useAuthorDirectoryMerge } from './useAuthorDirectoryMerge';
import { useAuthorDirectoryRename } from './useAuthorDirectoryRename';
import { useCreateAuthorMutation } from './useCreateAuthorMutation';
import { useMangaMutations } from './useMangaMutations';
import { useOrganizerMutationErrors } from './useOrganizerMutationErrors';

interface UseOrganizerMutationsArgs {
  hasIpcBridge: boolean;
  fetchMangas: () => Promise<void>;
  categories: OrganizerCategory[];
  aliases: DirectoryAlias[];
  setSelectedIds: (updater: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
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
    setSelectedCategoryKey,
    addAuthorDirectoryLocal,
    setMoveError
  });

  const authorDirectoryRename = useAuthorDirectoryRename({
    hasIpcBridge,
    setSelectedCategoryKey,
    setMoveError
  });

  const authorDirectoryMerge = useAuthorDirectoryMerge({
    hasIpcBridge,
    setSelectedCategoryKey,
    setMoveError
  });

  const authorDirectoryDelete = useAuthorDirectoryDelete({
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
    ...authorDirectoryMerge,
    ...authorDirectoryDelete,
    moveError,
    setMoveError
  };
}
