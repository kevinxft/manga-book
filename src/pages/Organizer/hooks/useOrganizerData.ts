import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DirectoryAlias, MangaBookWithCover, TargetDirectorySummary } from '@shared/types';
import { ipcInvoke } from '@renderer/ipc/client';
import type { OrganizerCategory } from '../types';
import { buildOrganizerCategories, buildOrganizerItems } from '../utils';

interface UseOrganizerDataArgs {
  mangas: MangaBookWithCover[];
  hasIpcBridge: boolean;
  fetchMangas: (options?: { sortBy?: 'title' | 'addedAt' | 'lastReadAt' }) => Promise<void>;
}

interface UseOrganizerDataResult {
  aliases: DirectoryAlias[];
  categories: OrganizerCategory[];
  organizerItems: ReturnType<typeof buildOrganizerItems>;
  selectedCategoryKey: string | null;
  setSelectedCategoryKey: (value: string | null) => void;
  refreshAuthorDirectories: () => Promise<void>;
  upsertAlias: (alias: DirectoryAlias) => void;
  removeAliasLocal: (aliasName: string) => void;
  addAuthorDirectoryLocal: (directoryPath: string) => void;
}

export function useOrganizerData({ mangas, hasIpcBridge, fetchMangas }: UseOrganizerDataArgs): UseOrganizerDataResult {
  const [aliases, setAliases] = useState<DirectoryAlias[]>([]);
  const [authorDirectories, setAuthorDirectories] = useState<TargetDirectorySummary[]>([]);
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string | null>(null);

  const fetchAliases = useCallback(async () => {
    if (!hasIpcBridge) {
      return;
    }
    try {
      const records = await ipcInvoke('organizer.listAliases', undefined);
      setAliases(records);
    } catch {
      // ignore alias load errors to avoid blocking page
    }
  }, [hasIpcBridge]);

  const fetchAuthorDirectories = useCallback(async () => {
    if (!hasIpcBridge) {
      return;
    }
    try {
      const items = await ipcInvoke('organizer.listAuthorDirectories', undefined);
      setAuthorDirectories(items);
    } catch {
      // ignore author directory load errors to avoid blocking page
    }
  }, [hasIpcBridge]);

  useEffect(() => {
    if (!hasIpcBridge) {
      return;
    }
    void (async () => {
      await Promise.all([fetchMangas({ sortBy: 'addedAt' }), fetchAliases(), fetchAuthorDirectories()]);
    })();
  }, [fetchAliases, fetchAuthorDirectories, fetchMangas, hasIpcBridge]);

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

  const upsertAlias = useCallback((storedAlias: DirectoryAlias) => {
    setAliases((prev) => {
      const aliasKey = storedAlias.alias.trim().toLocaleLowerCase();
      const next = prev.filter((item) => item.alias.trim().toLocaleLowerCase() !== aliasKey);
      next.push(storedAlias);
      next.sort((a, b) => a.alias.localeCompare(b.alias, 'zh-Hans-CN'));
      return next;
    });
  }, []);

  const removeAliasLocal = useCallback((aliasName: string) => {
    setAliases((prev) => prev.filter((item) => item.alias.trim().toLocaleLowerCase() !== aliasName.trim().toLocaleLowerCase()));
  }, []);

  const addAuthorDirectoryLocal = useCallback((directoryPath: string) => {
    setAuthorDirectories((prev) => {
      const normalized = directoryPath.trim();
      if (!normalized) {
        return prev;
      }
      if (prev.some((item) => item.directory === normalized)) {
        return prev;
      }
      return [...prev, { directory: normalized, mangaCount: 0, lastMovedAt: null }];
    });
  }, []);

  return {
    aliases,
    categories,
    organizerItems,
    selectedCategoryKey,
    setSelectedCategoryKey,
    refreshAuthorDirectories: fetchAuthorDirectories,
    upsertAlias,
    removeAliasLocal,
    addAuthorDirectoryLocal
  };
}
