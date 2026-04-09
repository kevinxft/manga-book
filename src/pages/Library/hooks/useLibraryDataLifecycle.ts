import { useEffect } from 'react';
import type { MangaFilter, ScanProgress } from '@shared/types';

interface UseLibraryDataLifecycleInput {
  hasIpcBridge: boolean;
  fetchSources: () => Promise<void>;
  fetchMangas: (options?: MangaFilter) => Promise<void>;
  refreshScanProgress: () => Promise<void>;
  progress: ScanProgress;
}

export function useLibraryDataLifecycle({
  hasIpcBridge,
  fetchSources,
  fetchMangas,
  refreshScanProgress,
  progress
}: UseLibraryDataLifecycleInput) {
  useEffect(() => {
    if (!hasIpcBridge) {
      return;
    }
    void fetchSources();
  }, [fetchSources, hasIpcBridge]);

  useEffect(() => {
    if (!hasIpcBridge) {
      return;
    }
    void fetchMangas();
  }, [fetchMangas, hasIpcBridge]);

  useEffect(() => {
    if (!hasIpcBridge) {
      return;
    }
    const timer = setInterval(() => {
      void refreshScanProgress();
    }, 1200);

    return () => clearInterval(timer);
  }, [hasIpcBridge, refreshScanProgress]);

  return {
    scanRunning: progress.status === 'running'
  };
}
