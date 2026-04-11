import { create } from 'zustand';
import type { DirectoryAlias, OrganizerMergeAuthorDirectoriesResult, TargetDirectorySummary } from '@shared/types';
import { ipcInvoke } from '@renderer/ipc/client';

interface OrganizerMetadataState {
  aliases: DirectoryAlias[];
  authorDirectories: TargetDirectorySummary[];
  loaded: boolean;
  error: string | null;
  ensureLoaded: () => Promise<void>;
  refreshOrganizerMetadata: () => Promise<void>;
  refreshAuthorDirectories: () => Promise<void>;
  upsertAlias: (alias: DirectoryAlias) => void;
  removeAliasLocal: (aliasName: string) => void;
  addAuthorDirectoryLocal: (directoryPath: string) => void;
  renameAuthorDirectoryLocal: (input: {
    previousPath: string;
    path: string;
    previousName: string;
    name: string;
  }) => void;
  mergeAuthorDirectoriesLocal: (result: OrganizerMergeAuthorDirectoriesResult) => void;
}

let organizerMetadataPromise: Promise<void> | null = null;

async function fetchOrganizerMetadata(force = false) {
  const [aliases, authorDirectories] = await Promise.all([
    ipcInvoke('organizer.listAliases', force ? { force: true } : undefined),
    ipcInvoke('organizer.listAuthorDirectories', undefined)
  ]);

  return { aliases, authorDirectories };
}

export const useOrganizerMetadataStore = create<OrganizerMetadataState>((set, get) => ({
  aliases: [],
  authorDirectories: [],
  loaded: false,
  error: null,

  async ensureLoaded() {
    if (get().loaded) {
      return;
    }
    if (organizerMetadataPromise) {
      return organizerMetadataPromise;
    }

    organizerMetadataPromise = (async () => {
      try {
        const { aliases, authorDirectories } = await fetchOrganizerMetadata(false);
        set({
          aliases,
          authorDirectories,
          loaded: true,
          error: null
        });
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to load organizer metadata'
        });
      } finally {
        organizerMetadataPromise = null;
      }
    })();

    return organizerMetadataPromise;
  },

  async refreshOrganizerMetadata() {
    if (organizerMetadataPromise) {
      return organizerMetadataPromise;
    }

    organizerMetadataPromise = (async () => {
      try {
        const { aliases, authorDirectories } = await fetchOrganizerMetadata(true);
        set({
          aliases,
          authorDirectories,
          loaded: true,
          error: null
        });
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to load organizer metadata'
        });
      } finally {
        organizerMetadataPromise = null;
      }
    })();

    return organizerMetadataPromise;
  },

  async refreshAuthorDirectories() {
    try {
      const authorDirectories = await ipcInvoke('organizer.listAuthorDirectories', undefined);
      set({
        authorDirectories,
        loaded: true,
        error: null
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load author directories'
      });
    }
  },

  upsertAlias(alias) {
    set((state) => {
      const aliasKey = alias.alias.trim().toLocaleLowerCase();
      const aliases = state.aliases.filter((item) => item.alias.trim().toLocaleLowerCase() !== aliasKey);
      aliases.push(alias);
      aliases.sort((first, second) => first.alias.localeCompare(second.alias, 'zh-Hans-CN'));
      return {
        aliases,
        loaded: true,
        error: null
      };
    });
  },

  removeAliasLocal(aliasName) {
    set((state) => ({
      aliases: state.aliases.filter((item) => item.alias.trim().toLocaleLowerCase() !== aliasName.trim().toLocaleLowerCase()),
      loaded: true,
      error: null
    }));
  },

  addAuthorDirectoryLocal(directoryPath) {
    set((state) => {
      const normalized = directoryPath.trim();
      if (!normalized) {
        return state;
      }
      if (state.authorDirectories.some((item) => item.directory === normalized)) {
        return state;
      }

      return {
        authorDirectories: [...state.authorDirectories, { directory: normalized, mangaCount: 0, lastMovedAt: null }],
        loaded: true,
        error: null
      };
    });
  },

  renameAuthorDirectoryLocal(input) {
    set((state) => {
      const previousPath = input.previousPath.trim();
      const nextPath = input.path.trim();
      const previousNameKey = input.previousName.trim().toLocaleLowerCase();
      const nextName = input.name.trim();

      if (!previousPath || !nextPath || !nextName) {
        return state;
      }

      const existingSummary = state.authorDirectories.find((item) => item.directory === previousPath);
      const nextAuthorDirectories = state.authorDirectories.map((item) =>
        item.directory === previousPath ? { ...item, directory: nextPath } : item
      );

      if (!existingSummary && !nextAuthorDirectories.some((item) => item.directory === nextPath)) {
        nextAuthorDirectories.push({ directory: nextPath, mangaCount: 0, lastMovedAt: null });
      }

      return {
        aliases: state.aliases.map((alias) =>
          alias.canonicalName.trim().toLocaleLowerCase() === previousNameKey
            ? { ...alias, canonicalName: nextName }
            : alias
        ),
        authorDirectories: nextAuthorDirectories,
        loaded: true,
        error: null
      };
    });
  },

  mergeAuthorDirectoriesLocal(result) {
    set((state) => {
      const deletedSourcePaths = new Set(result.deletedSourcePaths);
      const targetPath = result.targetPath.trim();
      if (!targetPath) {
        return state;
      }

      const nextAuthorDirectories = state.authorDirectories.filter((item) => !deletedSourcePaths.has(item.directory));
      if (!nextAuthorDirectories.some((item) => item.directory === targetPath)) {
        nextAuthorDirectories.push({
          directory: targetPath,
          mangaCount: result.movedMangas.length,
          lastMovedAt: new Date().toISOString()
        });
      }

      const aliasesByKey = new Map(
        state.aliases.map((alias) => [alias.alias.trim().toLocaleLowerCase(), alias])
      );
      for (const alias of result.aliases) {
        aliasesByKey.set(alias.alias.trim().toLocaleLowerCase(), alias);
      }

      return {
        aliases: [...aliasesByKey.values()].sort((first, second) => first.alias.localeCompare(second.alias, 'zh-Hans-CN')),
        authorDirectories: nextAuthorDirectories,
        loaded: true,
        error: null
      };
    });
  }
}));
