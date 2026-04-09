import { create } from 'zustand';
import type { ReaderMode, ReaderWidthMode } from '@renderer/pages/Reader/types';

const READER_MODE_STORAGE_KEY = 'manga-book.reader-mode';
const READER_WIDTH_MODE_STORAGE_KEY = 'manga-book.reader-width-mode';
const READER_FIXED_WIDTH_PERCENT_STORAGE_KEY = 'manga-book.reader-fixed-width-percent';
const READER_PAGE_ANIMATION_STORAGE_KEY = 'manga-book.reader-page-animation';
const READER_BOUNDARY_SUGGESTION_COUNT_STORAGE_KEY = 'manga-book.reader-boundary-suggestion-count';

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
  hydrated: boolean;
  readerMode: ReaderMode;
  widthMode: ReaderWidthMode;
  fixedWidthPercent: number;
  pageAnimationEnabled: boolean;
  boundarySuggestionCount: number;
  hydrate: () => void;
  setReaderMode: (mode: ReaderMode) => void;
  setWidthMode: (mode: ReaderWidthMode) => void;
  setFixedWidthPercent: (value: number) => void;
  setPageAnimationEnabled: (value: boolean) => void;
  setBoundarySuggestionCount: (value: number) => void;
  applySettings: (next: {
    readerMode: ReaderMode;
    widthMode: ReaderWidthMode;
    fixedWidthPercent: number;
    pageAnimationEnabled: boolean;
    boundarySuggestionCount: number;
  }) => void;
}

function persistSettings(settings: {
  readerMode: ReaderMode;
  widthMode: ReaderWidthMode;
  fixedWidthPercent: number;
  pageAnimationEnabled: boolean;
  boundarySuggestionCount: number;
}): void {
  try {
    window.localStorage.setItem(READER_MODE_STORAGE_KEY, settings.readerMode);
    window.localStorage.setItem(READER_WIDTH_MODE_STORAGE_KEY, settings.widthMode);
    window.localStorage.setItem(READER_FIXED_WIDTH_PERCENT_STORAGE_KEY, String(settings.fixedWidthPercent));
    window.localStorage.setItem(READER_PAGE_ANIMATION_STORAGE_KEY, settings.pageAnimationEnabled ? '1' : '0');
    window.localStorage.setItem(READER_BOUNDARY_SUGGESTION_COUNT_STORAGE_KEY, String(settings.boundarySuggestionCount));
  } catch {
    // ignore storage failures
  }
}

export const useReaderSettingsStore = create<ReaderSettingsState>((set, get) => ({
  hydrated: false,
  readerMode: 'paged',
  widthMode: 'fit',
  fixedWidthPercent: 90,
  pageAnimationEnabled: false,
  boundarySuggestionCount: 7,

  hydrate() {
    if (get().hydrated) {
      return;
    }

    let nextReaderMode: ReaderMode = 'paged';
    let nextWidthMode: ReaderWidthMode = 'fit';
    let nextFixedWidthPercent = 90;
    let nextPageAnimationEnabled = false;
    let nextBoundarySuggestionCount = 7;

    try {
      const savedMode = window.localStorage.getItem(READER_MODE_STORAGE_KEY);
      if (savedMode === 'paged' || savedMode === 'scroll') {
        nextReaderMode = savedMode;
      }

      const savedWidthMode = window.localStorage.getItem(READER_WIDTH_MODE_STORAGE_KEY);
      if (savedWidthMode === 'fit' || savedWidthMode === 'fixed') {
        nextWidthMode = savedWidthMode;
      }

      const savedFixedWidth = Number(window.localStorage.getItem(READER_FIXED_WIDTH_PERCENT_STORAGE_KEY));
      if (Number.isFinite(savedFixedWidth)) {
        nextFixedWidthPercent = snapWidthPercent(savedFixedWidth);
      }

      const savedAnimation = window.localStorage.getItem(READER_PAGE_ANIMATION_STORAGE_KEY);
      if (savedAnimation === '1' || savedAnimation === '0') {
        nextPageAnimationEnabled = savedAnimation === '1';
      }

      const savedBoundarySuggestionCount = Number(window.localStorage.getItem(READER_BOUNDARY_SUGGESTION_COUNT_STORAGE_KEY));
      if (Number.isFinite(savedBoundarySuggestionCount)) {
        nextBoundarySuggestionCount = clampBoundarySuggestionCount(savedBoundarySuggestionCount);
      }
    } catch {
      // ignore read failures
    }

    set({
      hydrated: true,
      readerMode: nextReaderMode,
      widthMode: nextWidthMode,
      fixedWidthPercent: nextFixedWidthPercent,
      pageAnimationEnabled: nextPageAnimationEnabled,
      boundarySuggestionCount: nextBoundarySuggestionCount
    });
  },

  setReaderMode(mode) {
    set({ readerMode: mode });
    const state = get();
    persistSettings(state);
  },

  setWidthMode(mode) {
    set({ widthMode: mode });
    const state = get();
    persistSettings(state);
  },

  setFixedWidthPercent(value) {
    if (!Number.isFinite(value)) return;
    set({ fixedWidthPercent: snapWidthPercent(value) });
    const state = get();
    persistSettings(state);
  },

  setPageAnimationEnabled(value) {
    set({ pageAnimationEnabled: value });
    const state = get();
    persistSettings(state);
  },

  setBoundarySuggestionCount(value) {
    if (!Number.isFinite(value)) return;
    set({ boundarySuggestionCount: clampBoundarySuggestionCount(value) });
    const state = get();
    persistSettings(state);
  },

  applySettings(next) {
    const fixedWidthPercent = snapWidthPercent(next.fixedWidthPercent);
    const boundarySuggestionCount = clampBoundarySuggestionCount(next.boundarySuggestionCount);
    set({
      readerMode: next.readerMode,
      widthMode: next.widthMode,
      fixedWidthPercent,
      pageAnimationEnabled: next.pageAnimationEnabled,
      boundarySuggestionCount
    });
    persistSettings({ ...next, fixedWidthPercent, boundarySuggestionCount });
  }
}));
