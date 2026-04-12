import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ReaderMode, ReaderWidthMode } from '@renderer/pages/Reader/types';

const READER_SETTINGS_STORAGE_KEY = 'manga-book.reader-settings';
const LEGACY_READER_MODE_STORAGE_KEY = 'manga-book.reader-mode';
const LEGACY_READER_WIDTH_MODE_STORAGE_KEY = 'manga-book.reader-width-mode';
const LEGACY_READER_FIXED_WIDTH_PERCENT_STORAGE_KEY = 'manga-book.reader-fixed-width-percent';
const LEGACY_READER_PAGE_ANIMATION_STORAGE_KEY = 'manga-book.reader-page-animation';
const LEGACY_READER_BOUNDARY_SUGGESTION_COUNT_STORAGE_KEY = 'manga-book.reader-boundary-suggestion-count';
const LEGACY_READER_REMEMBER_PROGRESS_STORAGE_KEY = 'manga-book.reader-remember-progress';

const MIN_FIXED_WIDTH_PERCENT = 50;
const MAX_FIXED_WIDTH_PERCENT = 100;
const MIN_BOUNDARY_SUGGESTION_COUNT = 3;
const MAX_BOUNDARY_SUGGESTION_COUNT = 12;

function snapWidthPercent(value: number): number {
  const snapped = Math.round(value / 5) * 5;
  return Math.min(MAX_FIXED_WIDTH_PERCENT, Math.max(MIN_FIXED_WIDTH_PERCENT, snapped));
}

function clampBoundarySuggestionCount(value: number): number {
  return Math.min(MAX_BOUNDARY_SUGGESTION_COUNT, Math.max(MIN_BOUNDARY_SUGGESTION_COUNT, Math.round(value)));
}

interface ReaderSettingsState {
  readerMode: ReaderMode;
  widthMode: ReaderWidthMode;
  fixedWidthPercent: number;
  pageAnimationEnabled: boolean;
  boundarySuggestionCount: number;
  rememberReadingProgress: boolean;
  setReaderMode: (mode: ReaderMode) => void;
  setWidthMode: (mode: ReaderWidthMode) => void;
  setFixedWidthPercent: (value: number) => void;
  setPageAnimationEnabled: (value: boolean) => void;
  setBoundarySuggestionCount: (value: number) => void;
  setRememberReadingProgress: (value: boolean) => void;
  applySettings: (next: {
    readerMode: ReaderMode;
    widthMode: ReaderWidthMode;
    fixedWidthPercent: number;
    pageAnimationEnabled: boolean;
    boundarySuggestionCount: number;
    rememberReadingProgress: boolean;
  }) => void;
}

function readLegacyReaderSettings(): Pick<
  ReaderSettingsState,
  | 'readerMode'
  | 'widthMode'
  | 'fixedWidthPercent'
  | 'pageAnimationEnabled'
  | 'boundarySuggestionCount'
  | 'rememberReadingProgress'
> {
  let readerMode: ReaderMode = 'paged';
  let widthMode: ReaderWidthMode = 'fit';
  let fixedWidthPercent = 90;
  let pageAnimationEnabled = false;
  let boundarySuggestionCount = 7;
  let rememberReadingProgress = true;

  if (typeof window === 'undefined') {
    return {
      readerMode,
      widthMode,
      fixedWidthPercent,
      pageAnimationEnabled,
      boundarySuggestionCount,
      rememberReadingProgress
    };
  }

  try {
    const savedMode = window.localStorage.getItem(LEGACY_READER_MODE_STORAGE_KEY);
    if (savedMode === 'paged' || savedMode === 'scroll') {
      readerMode = savedMode;
    }

    const savedWidthMode = window.localStorage.getItem(LEGACY_READER_WIDTH_MODE_STORAGE_KEY);
    if (savedWidthMode === 'fit' || savedWidthMode === 'fixed') {
      widthMode = savedWidthMode;
    }

    const savedFixedWidth = Number(window.localStorage.getItem(LEGACY_READER_FIXED_WIDTH_PERCENT_STORAGE_KEY));
    if (Number.isFinite(savedFixedWidth)) {
      fixedWidthPercent = snapWidthPercent(savedFixedWidth);
    }

    const savedAnimation = window.localStorage.getItem(LEGACY_READER_PAGE_ANIMATION_STORAGE_KEY);
    if (savedAnimation === '1' || savedAnimation === '0') {
      pageAnimationEnabled = savedAnimation === '1';
    }

    const savedBoundarySuggestionCount = Number(
      window.localStorage.getItem(LEGACY_READER_BOUNDARY_SUGGESTION_COUNT_STORAGE_KEY)
    );
    if (Number.isFinite(savedBoundarySuggestionCount)) {
      boundarySuggestionCount = clampBoundarySuggestionCount(savedBoundarySuggestionCount);
    }

    const savedRememberReadingProgress = window.localStorage.getItem(LEGACY_READER_REMEMBER_PROGRESS_STORAGE_KEY);
    if (savedRememberReadingProgress === '1' || savedRememberReadingProgress === '0') {
      rememberReadingProgress = savedRememberReadingProgress === '1';
    }
  } catch {
    // ignore storage failures
  }

  return {
    readerMode,
    widthMode,
    fixedWidthPercent,
    pageAnimationEnabled,
    boundarySuggestionCount,
    rememberReadingProgress
  };
}

const legacyDefaults = readLegacyReaderSettings();

export const useReaderSettingsStore = create<ReaderSettingsState>()(
  persist(
    (set) => ({
      ...legacyDefaults,

      setReaderMode(mode) {
        set({ readerMode: mode });
      },

      setWidthMode(mode) {
        set({ widthMode: mode });
      },

      setFixedWidthPercent(value) {
        if (!Number.isFinite(value)) return;
        set({ fixedWidthPercent: snapWidthPercent(value) });
      },

      setPageAnimationEnabled(value) {
        set({ pageAnimationEnabled: value });
      },

      setBoundarySuggestionCount(value) {
        if (!Number.isFinite(value)) return;
        set({ boundarySuggestionCount: clampBoundarySuggestionCount(value) });
      },

      setRememberReadingProgress(value) {
        set({ rememberReadingProgress: value });
      },

      applySettings(next) {
        set({
          readerMode: next.readerMode,
          widthMode: next.widthMode,
          fixedWidthPercent: snapWidthPercent(next.fixedWidthPercent),
          pageAnimationEnabled: next.pageAnimationEnabled,
          boundarySuggestionCount: clampBoundarySuggestionCount(next.boundarySuggestionCount),
          rememberReadingProgress: next.rememberReadingProgress
        });
      }
    }),
    {
      name: READER_SETTINGS_STORAGE_KEY,
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state) => ({
        readerMode: state.readerMode,
        widthMode: state.widthMode,
        fixedWidthPercent: state.fixedWidthPercent,
        pageAnimationEnabled: state.pageAnimationEnabled,
        boundarySuggestionCount: state.boundarySuggestionCount,
        rememberReadingProgress: state.rememberReadingProgress
      })
    }
  )
);
