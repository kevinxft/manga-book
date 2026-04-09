import { useEffect, useMemo } from 'react';
import type { MangaBookWithCover } from '@shared/types';
import { buildOrganizerCategories } from '@renderer/pages/Organizer/utils';
import { useOrganizerMetadataStore } from '@renderer/stores/organizerMetadataStore';

interface UseLibraryOrganizerCategoriesInput {
  hasIpcBridge: boolean;
  mangas: MangaBookWithCover[];
  targetSourcePaths: string[];
}

export function useLibraryOrganizerCategories({ hasIpcBridge, mangas, targetSourcePaths }: UseLibraryOrganizerCategoriesInput) {
  const aliases = useOrganizerMetadataStore((state) => state.aliases);
  const authorDirectories = useOrganizerMetadataStore((state) => state.authorDirectories);
  const ensureLoaded = useOrganizerMetadataStore((state) => state.ensureLoaded);

  useEffect(() => {
    if (!hasIpcBridge) {
      return;
    }
    void ensureLoaded();
  }, [ensureLoaded, hasIpcBridge]);

  const quickMoveCategories = useMemo(() => {
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
      authorDirectories.map((item) => item.directory),
      targetSourcePaths
    ).map((category) => ({
      ...category,
      aliases: aliasMap.get(category.label.trim().toLocaleLowerCase()) ?? [],
      lastMovedAt: movedAtByPath.get(category.path) ?? null
    }));
  }, [aliases, authorDirectories, mangas, targetSourcePaths]);

  return {
    artistDirectories: quickMoveCategories,
    quickMoveCategories
  };
}
