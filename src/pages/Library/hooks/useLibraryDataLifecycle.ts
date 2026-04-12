import { useEffect } from 'react';
import type { MangaFilter, ScanProgress } from '@shared/types';

interface UseLibraryDataLifecycleInput {
  active: boolean;
  hasIpcBridge: boolean;
  fetchLibraryRoot: () => Promise<void>;
  hasLibraryRoot: boolean;
  fetchMangas: (options?: MangaFilter) => Promise<void>;
  handleScanTaskUpdate: (payload: import('@shared/types').ScanTaskEvent) => Promise<void>;
  refreshScanProgress: () => Promise<void>;
  progress: ScanProgress;
}

export function useLibraryDataLifecycle({
  active,
  hasIpcBridge,
  fetchLibraryRoot,
  hasLibraryRoot,
  fetchMangas,
  handleScanTaskUpdate,
  refreshScanProgress,
  progress
}: UseLibraryDataLifecycleInput) {
  useEffect(() => {
    if (!active || !hasIpcBridge) {
      return;
    }
    void fetchLibraryRoot();
  }, [active, fetchLibraryRoot, hasIpcBridge]);

  useEffect(() => {
    if (!active || !hasIpcBridge || !hasLibraryRoot) {
      return;
    }
    void fetchMangas();
  }, [active, fetchMangas, hasIpcBridge, hasLibraryRoot]);

  useEffect(() => {
    if (!active || !hasIpcBridge) {
      return;
    }
    void refreshScanProgress();
    const unsubscribe = window.mangaBookApi.onScanProgress((payload) => {
      void handleScanTaskUpdate(payload);
    });

    return unsubscribe;
  }, [active, handleScanTaskUpdate, hasIpcBridge, refreshScanProgress]);

  return {
    scanRunning: progress.status === 'running'
  };
}
