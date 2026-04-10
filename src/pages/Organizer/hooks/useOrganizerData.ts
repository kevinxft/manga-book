import { useEffect, useMemo } from 'react';
import type { MangaBookWithCover } from '@shared/types';
import type { SortKey } from '@renderer/pages/Library/types';
import { useOrganizerMetadataStore } from '@renderer/stores/organizerMetadataStore';
import { useOrganizerSelectionStore } from '@renderer/stores/organizerSelectionStore';
import type { OrganizerCategory } from '../types';
import { buildOrganizerCategories, buildOrganizerItems } from '../utils';

interface UseOrganizerDataArgs {
  active: boolean;
  mangas: MangaBookWithCover[];
  hasIpcBridge: boolean;
  fetchMangas: (options?: { sortBy?: SortKey }) => Promise<void>;
  targetSourcePaths: string[];
}

interface UseOrganizerDataResult {
  aliases: ReturnType<typeof useOrganizerMetadataStore.getState>['aliases'];
  categories: OrganizerCategory[];
  organizerItems: ReturnType<typeof buildOrganizerItems>;
  setSelectedCategoryKey: (value: string | null) => void;
  refreshOrganizerMetadata: () => Promise<void>;
  refreshAuthorDirectories: () => Promise<void>;
  upsertAlias: ReturnType<typeof useOrganizerMetadataStore.getState>['upsertAlias'];
  removeAliasLocal: (aliasName: string) => void;
  addAuthorDirectoryLocal: (directoryPath: string) => void;
}

const EMPTY_ALIASES: ReturnType<typeof useOrganizerMetadataStore.getState>['aliases'] = [];
const EMPTY_AUTHOR_DIRECTORIES: ReturnType<typeof useOrganizerMetadataStore.getState>['authorDirectories'] = [];
const noopAsync = async () => {};
const noopUpsertAlias: UseOrganizerDataResult['upsertAlias'] = () => {};
const noopRemoveAlias = () => {};
const noopAddAuthorDirectory = () => {};

export function useOrganizerData({ active, mangas, hasIpcBridge, fetchMangas, targetSourcePaths }: UseOrganizerDataArgs): UseOrganizerDataResult {
  const setSelectedCategoryKey = useOrganizerSelectionStore((state) => state.setSelectedCategoryKey);
  const aliases = useOrganizerMetadataStore((state) => (active ? state.aliases : EMPTY_ALIASES));
  const authorDirectories = useOrganizerMetadataStore((state) => (active ? state.authorDirectories : EMPTY_AUTHOR_DIRECTORIES));
  const ensureLoaded = useOrganizerMetadataStore((state) => (active ? state.ensureLoaded : noopAsync));
  const refreshOrganizerMetadata = useOrganizerMetadataStore((state) => (active ? state.refreshOrganizerMetadata : noopAsync));
  const refreshAuthorDirectories = useOrganizerMetadataStore((state) => (active ? state.refreshAuthorDirectories : noopAsync));
  const upsertAlias = useOrganizerMetadataStore((state) => (active ? state.upsertAlias : noopUpsertAlias));
  const removeAliasLocal = useOrganizerMetadataStore((state) => (active ? state.removeAliasLocal : noopRemoveAlias));
  const addAuthorDirectoryLocal = useOrganizerMetadataStore((state) => (active ? state.addAuthorDirectoryLocal : noopAddAuthorDirectory));

  useEffect(() => {
    if (!active || !hasIpcBridge) {
      return;
    }
    void (async () => {
      await Promise.all([mangas.length === 0 ? fetchMangas() : Promise.resolve(), ensureLoaded()]);
    })();
  }, [active, ensureLoaded, fetchMangas, hasIpcBridge, mangas.length]);

  const authorDirectoryPaths = useMemo(
    () => authorDirectories.map((item) => item.directory),
    [authorDirectories]
  );

  const categories = useMemo(() => {
    const aliasMap = new Map<string, string[]>();
    for (const item of aliases) {
      const key = item.canonicalName.trim().toLocaleLowerCase();
      const prev = aliasMap.get(key) ?? [];
      if (!prev.some((name) => name.toLocaleLowerCase() === item.alias.toLocaleLowerCase())) {
        prev.push(item.alias);
        aliasMap.set(key, prev);
      }
    }

    const movedAtByPath = new Map(authorDirectories.map((item) => [item.directory, item.lastMovedAt]));

    return buildOrganizerCategories(
      mangas,
      authorDirectoryPaths,
      targetSourcePaths
    ).map((category) => ({
      ...category,
      aliases: aliasMap.get(category.label.trim().toLocaleLowerCase()) ?? [],
      lastMovedAt: movedAtByPath.get(category.path) ?? null
    }));
  }, [aliases, authorDirectories, authorDirectoryPaths, mangas, targetSourcePaths]);

  const organizerItems = useMemo(
    () => buildOrganizerItems(mangas, aliases, targetSourcePaths, authorDirectoryPaths),
    [aliases, authorDirectoryPaths, mangas, targetSourcePaths]
  );

  useEffect(() => {
    const { selectedCategoryKey } = useOrganizerSelectionStore.getState();

    if (categories.length === 0) {
      if (selectedCategoryKey !== null) {
        setSelectedCategoryKey(null);
      }
      return;
    }

    if (selectedCategoryKey && categories.some((item) => item.key === selectedCategoryKey)) {
      return;
    }

    setSelectedCategoryKey(categories[0]?.key ?? null);
  }, [categories, setSelectedCategoryKey]);

  return {
    aliases,
    categories,
    organizerItems,
    setSelectedCategoryKey,
    refreshOrganizerMetadata,
    refreshAuthorDirectories,
    upsertAlias,
    removeAliasLocal,
    addAuthorDirectoryLocal
  };
}
