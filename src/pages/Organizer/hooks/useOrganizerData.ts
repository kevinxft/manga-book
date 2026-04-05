import { useEffect, useMemo, useState } from 'react';
import type { MangaBookWithCover } from '@shared/types';
import type { SortKey } from '@renderer/pages/Library/types';
import { useOrganizerMetadataStore } from '@renderer/stores/organizerMetadataStore';
import type { OrganizerCategory } from '../types';
import { buildOrganizerCategories, buildOrganizerItems } from '../utils';

interface UseOrganizerDataArgs {
  mangas: MangaBookWithCover[];
  hasIpcBridge: boolean;
  fetchMangas: (options?: { sortBy?: SortKey }) => Promise<void>;
}

interface UseOrganizerDataResult {
  aliases: ReturnType<typeof useOrganizerMetadataStore.getState>['aliases'];
  categories: OrganizerCategory[];
  organizerItems: ReturnType<typeof buildOrganizerItems>;
  selectedCategoryKey: string | null;
  setSelectedCategoryKey: (value: string | null) => void;
  refreshAuthorDirectories: () => Promise<void>;
  upsertAlias: ReturnType<typeof useOrganizerMetadataStore.getState>['upsertAlias'];
  removeAliasLocal: (aliasName: string) => void;
  addAuthorDirectoryLocal: (directoryPath: string) => void;
}

export function useOrganizerData({ mangas, hasIpcBridge, fetchMangas }: UseOrganizerDataArgs): UseOrganizerDataResult {
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string | null>(null);
  const aliases = useOrganizerMetadataStore((state) => state.aliases);
  const authorDirectories = useOrganizerMetadataStore((state) => state.authorDirectories);
  const ensureLoaded = useOrganizerMetadataStore((state) => state.ensureLoaded);
  const refreshAuthorDirectories = useOrganizerMetadataStore((state) => state.refreshAuthorDirectories);
  const upsertAlias = useOrganizerMetadataStore((state) => state.upsertAlias);
  const removeAliasLocal = useOrganizerMetadataStore((state) => state.removeAliasLocal);
  const addAuthorDirectoryLocal = useOrganizerMetadataStore((state) => state.addAuthorDirectoryLocal);

  useEffect(() => {
    if (!hasIpcBridge) {
      return;
    }
    void (async () => {
      await Promise.all([mangas.length === 0 ? fetchMangas() : Promise.resolve(), ensureLoaded()]);
    })();
  }, [ensureLoaded, fetchMangas, hasIpcBridge, mangas.length]);

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
      authorDirectories.map((item) => item.directory)
    ).map((category) => ({
      ...category,
      aliases: aliasMap.get(category.label.trim().toLocaleLowerCase()) ?? [],
      lastMovedAt: movedAtByPath.get(category.path) ?? null
    }));
  }, [aliases, authorDirectories, mangas]);

  const organizerItems = useMemo(() => buildOrganizerItems(mangas, aliases), [aliases, mangas]);

  useEffect(() => {
    if (categories.length === 0) {
      setSelectedCategoryKey(null);
      return;
    }

    setSelectedCategoryKey((prev) => {
      if (prev && categories.some((item) => item.key === prev)) {
        return prev;
      }
      return categories[0]?.key ?? null;
    });
  }, [categories]);

  return {
    aliases,
    categories,
    organizerItems,
    selectedCategoryKey,
    setSelectedCategoryKey,
    refreshAuthorDirectories,
    upsertAlias,
    removeAliasLocal,
    addAuthorDirectoryLocal
  };
}
