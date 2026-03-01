import { create } from 'zustand';
import type { LibraryFolder, MangaBookWithCover, ScanProgress } from '@shared/types';
import { ipcInvoke } from '@renderer/ipc/client';

interface LibraryState {
  sources: LibraryFolder[];
  mangas: MangaBookWithCover[];
  progress: ScanProgress;
  loading: boolean;
  error: string | null;
  fetchSources: () => Promise<void>;
  fetchMangas: (options?: { query?: string; sourceFolderPaths?: string[]; sortBy?: 'title' | 'addedAt' | 'lastReadAt' }) => Promise<void>;
  addSource: (sourcePath: string) => Promise<void>;
  addSources: (sourcePaths: string[]) => Promise<void>;
  pickAndAddSources: () => Promise<void>;
  removeSource: (id: string) => Promise<void>;
  syncSources: () => Promise<void>;
  refreshScanProgress: () => Promise<void>;
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

  async fetchSources() {
    try {
      const sources = await ipcInvoke('library.listSources', undefined);
      set({ sources });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load sources' });
    }
  },

  async fetchMangas(options) {
    set({ loading: true, error: null });
    try {
      const mangas = await ipcInvoke('library.listMangas', {
        query: options?.query,
        sourceFolderPaths: options?.sourceFolderPaths,
        sortBy: options?.sortBy
      });
      set({ mangas, loading: false });
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

  async syncSources() {
    set({ error: null });
    try {
      await ipcInvoke('library.syncSources', { forceRescan: true });
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
        previousProgress.status === 'running' && progress.status === 'idle';

      if (scanJustFinished) {
        await get().fetchMangas();
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to fetch scan progress' });
    }
  }
}));
