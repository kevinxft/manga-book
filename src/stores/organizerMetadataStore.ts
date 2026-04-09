import { create } from 'zustand';
import type { DirectoryAlias, TargetDirectorySummary } from '@shared/types';
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
  }
}));
