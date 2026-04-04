import { useEffect } from 'react';
import type { ScanProgress } from '@shared/types';
import type { SortKey } from '../types';

interface UseLibraryDataLifecycleInput {
  hasIpcBridge: boolean;
  search: string;
  sortBy: SortKey;
  fetchSources: () => Promise<void>;
  fetchMangas: (options?: { query?: string; sourceFolderPaths?: string[]; sortBy?: SortKey }) => Promise<void>;
  refreshScanProgress: () => Promise<void>;
  progress: ScanProgress;
}

export function useLibraryDataLifecycle({
  hasIpcBridge,
  search,
  sortBy,
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
    void fetchMangas({ query: search, sortBy });
  }, [fetchMangas, hasIpcBridge, search, sortBy]);

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
