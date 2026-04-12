import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const LIBRARY_UI_STORAGE_KEY = 'manga-book.library-ui';
const LEGACY_LIBRARY_SIDEBAR_COLLAPSED_STORAGE_KEY = 'manga-book.library-sidebar-collapsed';
const LEGACY_LIBRARY_SIDEBAR_WIDTH_STORAGE_KEY = 'manga-book.library-sidebar-width';
const DEFAULT_LIBRARY_SIDEBAR_WIDTH = 270;

interface LibraryUiState {
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  setSidebarCollapsed: (value: boolean) => void;
  setSidebarWidth: (value: number) => void;
}

function readLegacyLibraryUiState(): Pick<LibraryUiState, 'sidebarCollapsed' | 'sidebarWidth'> {
  let sidebarCollapsed = false;
  let sidebarWidth = DEFAULT_LIBRARY_SIDEBAR_WIDTH;

  if (typeof window === 'undefined') {
    return { sidebarCollapsed, sidebarWidth };
  }

  try {
    sidebarCollapsed = window.localStorage.getItem(LEGACY_LIBRARY_SIDEBAR_COLLAPSED_STORAGE_KEY) === '1';

    const rawSidebarWidth = window.localStorage.getItem(LEGACY_LIBRARY_SIDEBAR_WIDTH_STORAGE_KEY);
    const parsedSidebarWidth = rawSidebarWidth ? Number.parseInt(rawSidebarWidth, 10) : Number.NaN;
    if (Number.isFinite(parsedSidebarWidth)) {
      sidebarWidth = parsedSidebarWidth;
    }
  } catch {
    // ignore storage failures
  }

  return { sidebarCollapsed, sidebarWidth };
}

const legacyDefaults = readLegacyLibraryUiState();

export const useLibraryUiStore = create<LibraryUiState>()(
  persist(
    (set) => ({
      ...legacyDefaults,

      setSidebarCollapsed(value) {
        set({ sidebarCollapsed: value });
      },

      setSidebarWidth(value) {
        set({ sidebarWidth: value });
      }
    }),
    {
      name: LIBRARY_UI_STORAGE_KEY,
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        sidebarWidth: state.sidebarWidth
      })
    }
  )
);
