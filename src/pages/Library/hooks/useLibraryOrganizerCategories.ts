import { useEffect, useMemo, useState } from 'react';
import type { DirectoryAlias, MangaBookWithCover, TargetDirectorySummary } from '@shared/types';
import { ipcInvoke } from '@renderer/ipc/client';
import { buildOrganizerCategories } from '@renderer/pages/Organizer/utils';

interface UseLibraryOrganizerCategoriesInput {
  hasIpcBridge: boolean;
  mangas: MangaBookWithCover[];
}

export function useLibraryOrganizerCategories({ hasIpcBridge, mangas }: UseLibraryOrganizerCategoriesInput) {
  const [aliases, setAliases] = useState<DirectoryAlias[]>([]);
  const [authorDirectories, setAuthorDirectories] = useState<TargetDirectorySummary[]>([]);

  useEffect(() => {
    if (!hasIpcBridge) {
      return;
    }

    void (async () => {
      try {
        const [aliasItems, directoryItems] = await Promise.all([
          ipcInvoke('organizer.listAliases', undefined),
          ipcInvoke('organizer.listAuthorDirectories', undefined)
        ]);
        setAliases(aliasItems);
        setAuthorDirectories(directoryItems);
      } catch {
        // ignore organizer helper data load failure
      }
    })();
  }, [hasIpcBridge]);

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
      authorDirectories.map((item) => item.directory)
    ).map((category) => ({
      ...category,
      aliases: aliasMap.get(category.label.trim().toLocaleLowerCase()) ?? [],
      lastMovedAt: movedAtByPath.get(category.path) ?? null
    }));
  }, [aliases, authorDirectories, mangas]);

  return {
    artistDirectories: quickMoveCategories,
    quickMoveCategories
  };
}
