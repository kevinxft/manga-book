import { create } from 'zustand';
import type { LibraryFolder, LibraryRoot, MangaBookWithCover, ScanProgress, ScanTaskEvent } from '@shared/types';
import { ipcInvoke } from '@renderer/ipc/client';
import type { SortKey } from '@renderer/pages/Library/types';
import { useOrganizerMetadataStore } from './organizerMetadataStore';

type LibraryFetchOptions = {
  query?: string;
  sourceFolderPaths?: string[];
  sortBy?: SortKey;
};

const resolvedCoverFolderPaths = new Set<string>();
const locallyCancelledScanTaskIds = new Set<string>();

function toLegacySources(root: LibraryRoot | null): LibraryFolder[] {
  return root
    ? [
        {
          id: root.path,
          path: root.path,
          displayName: root.displayName,
          addedAt: root.initializedAt,
          isTarget: true
        }
      ]
    : [];
}

const idleProgress: ScanProgress = {
  taskId: null,
  status: 'idle',
  current: 0,
  total: 0,
  message: 'Idle',
  sourceCurrent: 0,
  sourceTotal: 0,
  sourceName: '',
  itemCurrent: 0,
  itemTotal: 0,
  currentItemName: ''
};

interface LibraryState {
  libraryRoot: LibraryRoot | null;
  sources: LibraryFolder[];
  mangas: MangaBookWithCover[];
  progress: ScanProgress;
  loading: boolean;
  error: string | null;
  lastFetchOptions: LibraryFetchOptions;
  clearError: () => void;
  fetchLibraryRoot: () => Promise<void>;
  setLibraryRoot: (rootPath: string) => Promise<void>;
  createLibraryRoot: (parentPath: string, directoryName: string) => Promise<void>;
  pickLibraryRootParent: () => Promise<string | null>;
  clearLibraryRoot: () => Promise<void>;
  openLibraryRoot: () => Promise<void>;
  importDirectories: (paths: string[]) => Promise<void>;
  pickAndImportDirectories: () => Promise<void>;
  syncLibrary: () => Promise<void>;
  fetchSources: () => Promise<void>;
  fetchMangas: (options?: LibraryFetchOptions) => Promise<void>;
  addSource: (sourcePath: string) => Promise<void>;
  addSources: (sourcePaths: string[]) => Promise<void>;
  pickAndAddSources: () => Promise<void>;
  removeSource: (id: string) => Promise<void>;
  openSourceFolder: (path: string) => Promise<void>;
  syncSources: (paths?: string[]) => Promise<void>;
  cancelSync: () => Promise<void>;
  fetchCoverPaths: (folderPaths: string[], options?: { force?: boolean }) => Promise<void>;
  handleScanTaskUpdate: (payload: ScanTaskEvent) => Promise<void>;
  refreshScanProgress: () => Promise<void>;
  updateMangaLocal: (mangaId: string, updater: (manga: MangaBookWithCover) => MangaBookWithCover | null) => void;
  updateAllMangasLocal: (updater: (manga: MangaBookWithCover) => MangaBookWithCover) => void;
  removeMangaLocal: (mangaId: string) => void;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  libraryRoot: null,
  sources: [],
  mangas: [],
  progress: idleProgress,
  loading: false,
  error: null,
  lastFetchOptions: {
    sortBy: 'addedAtDesc'
  },

  clearError() {
    set({ error: null });
  },

  async fetchLibraryRoot() {
    try {
      const libraryRoot = await ipcInvoke('library.getRoot', undefined);
      set({
        libraryRoot,
        sources: toLegacySources(libraryRoot)
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load library root' });
    }
  },

  async setLibraryRoot(rootPath) {
    set({ error: null, loading: true });
    try {
      const libraryRoot = await ipcInvoke('library.setRoot', { path: rootPath });
      resolvedCoverFolderPaths.clear();
      set({
        libraryRoot,
        sources: toLegacySources(libraryRoot)
      });
      await useOrganizerMetadataStore.getState().refreshOrganizerMetadata();
      await get().syncLibrary();
      await get().refreshScanProgress();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to set library root' });
    } finally {
      set({ loading: false });
    }
  },

  async createLibraryRoot(parentPath, directoryName) {
    set({ error: null, loading: true });
    try {
      const libraryRoot = await ipcInvoke('library.setRoot', { parentPath, directoryName });
      resolvedCoverFolderPaths.clear();
      set({
        libraryRoot,
        sources: toLegacySources(libraryRoot)
      });
      await useOrganizerMetadataStore.getState().refreshOrganizerMetadata();
      await get().syncLibrary();
      await get().refreshScanProgress();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create library root' });
    } finally {
      set({ loading: false });
    }
  },

  async pickLibraryRootParent() {
    set({ error: null });
    try {
      const picked = await ipcInvoke('library.pickLibraryRootDirectory', undefined);
      if (picked.paths.length === 0) {
        return null;
      }
      return picked.paths[0] as string;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to pick library root' });
      return null;
    }
  },

  async openLibraryRoot() {
    set({ error: null });
    try {
      await ipcInvoke('library.openRoot', undefined);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to open library root' });
    }
  },

  async clearLibraryRoot() {
    set({ error: null, loading: true });
    try {
      await ipcInvoke('library.clearRoot', undefined);
      resolvedCoverFolderPaths.clear();
      set({
        libraryRoot: null,
        sources: [],
        mangas: [],
        progress: idleProgress,
        lastFetchOptions: {
          sortBy: 'addedAtDesc'
        }
      });
      await useOrganizerMetadataStore.getState().refreshOrganizerMetadata();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to clear library root' });
    } finally {
      set({ loading: false });
    }
  },

  async importDirectories(paths) {
    set({ error: null });
    try {
      if (paths.length === 0) {
        return;
      }
      const result = await ipcInvoke('library.importDirectories', { paths });
      if (result.taskId) {
        set({
          progress: {
            ...idleProgress,
            taskId: result.taskId,
            status: 'running',
            message: 'Queued'
          }
        });
      } else {
        await get().fetchMangas();
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to import directories' });
    }
  },

  async pickAndImportDirectories() {
    set({ error: null });
    try {
      const picked = await ipcInvoke('library.pickImportDirectories', undefined);
      if (picked.paths.length === 0) {
        return;
      }
      await get().importDirectories(picked.paths);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to pick directories' });
    }
  },

  async syncLibrary() {
    set({ error: null });
    try {
      const result = await ipcInvoke('library.syncLibrary', { forceRescan: true });
      set({
        progress: {
          ...idleProgress,
          taskId: result.taskId,
          status: 'running',
          message: 'Queued'
        }
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to sync library' });
    }
  },

  async handleScanTaskUpdate(payload) {
    if (payload.taskId && locallyCancelledScanTaskIds.has(payload.taskId)) {
      if (payload.status === 'queued' || payload.status === 'running') {
        return;
      }
      locallyCancelledScanTaskIds.delete(payload.taskId);
    }

    if (payload.status === 'queued' || payload.status === 'running') {
      set({
        progress: {
          taskId: payload.taskId,
          status: 'running',
          current: payload.current,
          total: payload.total,
          message: payload.message,
          sourceCurrent: payload.sourceCurrent,
          sourceTotal: payload.sourceTotal,
          sourceName: payload.sourceName,
          itemCurrent: payload.itemCurrent,
          itemTotal: payload.itemTotal,
          currentItemName: payload.currentItemName
        }
      });
      return;
    }

    set({
      progress: {
        ...idleProgress,
        message: payload.status === 'completed' ? 'Idle' : payload.message
      }
    });

    if (payload.status === 'completed') {
      await Promise.all([get().fetchLibraryRoot(), get().fetchMangas()]);
      await useOrganizerMetadataStore.getState().refreshOrganizerMetadata();
    } else if (payload.status === 'failed') {
      set({ error: payload.error ?? 'Library sync failed' });
    }
  },

  async fetchSources() {
    await get().fetchLibraryRoot();
  },

  async fetchMangas(options) {
    const effectiveOptions = options ?? get().lastFetchOptions;
    set({ loading: true, error: null });
    try {
      const mangas = await ipcInvoke('library.listMangas', {
        query: effectiveOptions.query,
        sourceFolderPaths: effectiveOptions.sourceFolderPaths,
        sortBy: effectiveOptions.sortBy
      });
      resolvedCoverFolderPaths.clear();
      set({
        mangas,
        loading: false,
        lastFetchOptions: effectiveOptions
      });
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : 'Failed to load mangas' });
    }
  },

  async addSource(sourcePath) {
    await get().importDirectories([sourcePath]);
  },

  async addSources(sourcePaths) {
    await get().importDirectories(sourcePaths);
  },

  async pickAndAddSources() {
    await get().pickAndImportDirectories();
  },

  async removeSource() {
    set({ error: '单库模式下不支持移除来源目录，请改为更换漫画库位置。' });
  },

  async openSourceFolder() {
    await get().openLibraryRoot();
  },

  async syncSources() {
    await get().syncLibrary();
  },

  async cancelSync() {
    const previousProgress = get().progress;
    if (previousProgress.taskId) {
      locallyCancelledScanTaskIds.add(previousProgress.taskId);
    }
    set({
      error: null,
      progress: idleProgress
    });
    try {
      await ipcInvoke('library.cancelSync', {
        taskId: previousProgress.taskId ?? undefined
      });
    } catch (error) {
      if (previousProgress.taskId) {
        locallyCancelledScanTaskIds.delete(previousProgress.taskId);
      }
      set({ error: error instanceof Error ? error.message : 'Failed to cancel sync' });
    }
  },

  async fetchCoverPaths(folderPaths, options) {
    const uniqueFolderPaths = Array.from(
      new Set(
        folderPaths
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
      )
    );

    if (uniqueFolderPaths.length === 0) {
      return;
    }

    const targetFolderPaths = options?.force
      ? uniqueFolderPaths
      : uniqueFolderPaths.filter((folderPath) => !resolvedCoverFolderPaths.has(folderPath));

    if (targetFolderPaths.length === 0) {
      return;
    }

    try {
      const coverPathByFolder = await ipcInvoke('library.listCoverPaths', { folderPaths: targetFolderPaths });
      targetFolderPaths.forEach((folderPath) => resolvedCoverFolderPaths.add(folderPath));
      set((state) => ({
        mangas: state.mangas.map((manga) => {
          if (!(manga.folderPath in coverPathByFolder)) {
            return manga;
          }

          const nextCoverPath = coverPathByFolder[manga.folderPath] ?? null;
          return manga.coverPath === nextCoverPath ? manga : { ...manga, coverPath: nextCoverPath };
        })
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load cover paths' });
    }
  },

  async refreshScanProgress() {
    try {
      const progress = await ipcInvoke('library.getScanProgress', undefined);
      set({ progress });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to fetch scan progress' });
    }
  },

  updateMangaLocal(mangaId, updater) {
    set((state) => {
      const index = state.mangas.findIndex((item) => item.id === mangaId);
      if (index < 0) {
        return state;
      }

      const current = state.mangas[index] as MangaBookWithCover;
      const next = updater(current);

      if (!next) {
        return {
          mangas: state.mangas.filter((item) => item.id !== mangaId)
        };
      }

      if (next === current) {
        return state;
      }

      const mangas = [...state.mangas];
      mangas[index] = next;
      return { mangas };
    });
  },

  updateAllMangasLocal(updater) {
    set((state) => {
      let changed = false;

      const mangas = state.mangas.map((manga) => {
        const next = updater(manga);
        if (next !== manga) {
          changed = true;
        }
        return next;
      });

      return changed ? { mangas } : state;
    });
  },

  removeMangaLocal(mangaId) {
    set((state) => ({
      mangas: state.mangas.filter((item) => item.id !== mangaId)
    }));
  }
}));
