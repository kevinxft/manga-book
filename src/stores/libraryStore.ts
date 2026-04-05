import { create } from 'zustand';
import type { LibraryFolder, MangaBookWithCover, ScanProgress } from '@shared/types';
import { ipcInvoke } from '@renderer/ipc/client';
import type { SortKey } from '@renderer/pages/Library/types';

type LibraryFetchOptions = {
  query?: string;
  sourceFolderPaths?: string[];
  sortBy?: SortKey;
};

interface LibraryState {
  sources: LibraryFolder[];
  mangas: MangaBookWithCover[];
  progress: ScanProgress;
  loading: boolean;
  error: string | null;
  lastFetchOptions: LibraryFetchOptions;
  fetchSources: () => Promise<void>;
  fetchMangas: (options?: LibraryFetchOptions) => Promise<void>;
  addSource: (sourcePath: string) => Promise<void>;
  addSources: (sourcePaths: string[]) => Promise<void>;
  pickAndAddSources: () => Promise<void>;
  removeSource: (id: string) => Promise<void>;
  syncSources: (paths?: string[]) => Promise<void>;
  monitorScanTask: (taskId: string) => Promise<void>;
  refreshScanProgress: () => Promise<void>;
  updateMangaLocal: (mangaId: string, updater: (manga: MangaBookWithCover) => MangaBookWithCover | null) => void;
  updateAllMangasLocal: (updater: (manga: MangaBookWithCover) => MangaBookWithCover) => void;
  removeMangaLocal: (mangaId: string) => void;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  sources: [],
  mangas: [],
  progress: {
    taskId: null,
    status: 'idle',
    current: 0,
    total: 0,
    message: 'Idle'
  },
  loading: false,
  error: null,
  lastFetchOptions: {
    sortBy: 'addedAtDesc'
  },

  async monitorScanTask(taskId: string) {
    while (true) {
      try {
        const status = await ipcInvoke('library.getScanTaskStatus', { taskId });

        if (status.status === 'queued' || status.status === 'running') {
          set({
            progress: {
              taskId: status.taskId,
              status: 'running',
              current: status.current,
              total: status.total,
              message: status.message
            }
          });
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }

        set({
          progress: {
            taskId: null,
            status: 'idle',
            current: 0,
            total: 0,
            message: status.status === 'completed' ? 'Idle' : status.message
          }
        });

        if (status.status === 'completed') {
          await Promise.all([get().fetchSources(), get().fetchMangas()]);
        } else if (status.status === 'failed') {
          set({ error: status.error ?? 'Library sync failed' });
        }
        return;
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to track scan task' });
        return;
      }
    }
  },

  async fetchSources() {
    try {
      const sources = await ipcInvoke('library.listSources', undefined);
      set({ sources });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load sources' });
    }
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
    set({ error: null });
    try {
      await ipcInvoke('library.addSource', { path: sourcePath });
      await Promise.all([get().fetchSources(), get().fetchMangas()]);
      await get().refreshScanProgress();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to add source' });
    }
  },

  async addSources(sourcePaths) {
    set({ error: null });
    try {
      if (sourcePaths.length === 0) {
        return;
      }
      const result = await ipcInvoke('library.addSources', { paths: sourcePaths });
      await Promise.all([get().fetchSources(), get().fetchMangas()]);
      if (result.taskId) {
        set({
          progress: {
            taskId: result.taskId,
            status: 'running',
            current: 0,
            total: 0,
            message: 'Queued'
          }
        });
        void get().monitorScanTask(result.taskId);
        await get().refreshScanProgress();
      }
      if (result.added.length === 0 && result.skipped.length > 0) {
        const firstSkip = result.skipped[0];
        if (firstSkip) {
          if (firstSkip.reason === 'DUPLICATE') {
            set({ error: null });
            return;
          }
          const message =
            firstSkip.reason === 'NOT_FOUND'
                ? `目录不存在: ${firstSkip.path}`
                : firstSkip.reason === 'ORGANIZER_ROOT_CONFLICT'
                  ? '检测到 Artists + Inbox 的整理根目录已存在，仅允许导入一个。'
                : '目录无效';
          set({ error: message });
        }
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to add sources' });
    }
  },

  async pickAndAddSources() {
    set({ error: null });
    try {
      const picked = await ipcInvoke('library.pickSourceDirectories', undefined);
      if (picked.paths.length === 0) {
        return;
      }
      await get().addSources(picked.paths);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to pick source directories' });
    }
  },

  async removeSource(id) {
    set({ error: null });
    try {
      await ipcInvoke('library.removeSource', { id });
      await Promise.all([get().fetchSources(), get().fetchMangas()]);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to remove source' });
    }
  },

  async syncSources(paths) {
    set({ error: null });
    try {
      const result = await ipcInvoke('library.syncSources', {
        forceRescan: true,
        ...(paths && paths.length > 0 ? { paths } : {})
      });
      set({
        progress: {
          taskId: result.taskId,
          status: 'running',
          current: 0,
          total: 0,
          message: 'Queued'
        }
      });
      void get().monitorScanTask(result.taskId);
      await get().refreshScanProgress();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to sync sources' });
    }
  },

  async refreshScanProgress() {
    try {
      const previousProgress = get().progress;
      const progress = await ipcInvoke('library.getScanProgress', undefined);
      set({ progress });

      const scanJustFinished =
        previousProgress.taskId !== null && progress.status === 'idle';

      if (scanJustFinished) {
        await get().fetchMangas();
      }
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
