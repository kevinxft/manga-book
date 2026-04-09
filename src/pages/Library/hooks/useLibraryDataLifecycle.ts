import { useEffect } from 'react';
import type { MangaFilter, ScanProgress } from '@shared/types';

interface UseLibraryDataLifecycleInput {
  active: boolean;
  hasIpcBridge: boolean;
  fetchSources: () => Promise<void>;
  fetchMangas: (options?: MangaFilter) => Promise<void>;
  handleScanTaskUpdate: (payload: import('@shared/types').ScanTaskEvent) => Promise<void>;
  refreshScanProgress: () => Promise<void>;
  progress: ScanProgress;
}

export function useLibraryDataLifecycle({
  active,
  hasIpcBridge,
  fetchSources,
  fetchMangas,
  handleScanTaskUpdate,
  refreshScanProgress,
  progress
}: UseLibraryDataLifecycleInput) {
  useEffect(() => {
    if (!active || !hasIpcBridge) {
      return;
    }
    void fetchSources();
  }, [active, fetchSources, hasIpcBridge]);

  useEffect(() => {
    if (!active || !hasIpcBridge) {
      return;
    }
    void fetchMangas();
  }, [active, fetchMangas, hasIpcBridge]);

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
