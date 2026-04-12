import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ReaderChapterPanelMode = 'mini' | 'normal';

const READER_CHAPTER_PANEL_STORAGE_KEY = 'manga-book.reader-chapter-panel';
const LEGACY_READER_CHAPTER_PANEL_MODE_STORAGE_KEY = 'manga-book.reader-chapter-panel-mode';
const LEGACY_READER_CHAPTER_PANEL_MODE_BY_MANGA_STORAGE_KEY = 'manga-book.reader-chapter-panel-mode-by-manga';

interface ReaderChapterPanelState {
  preferredMode: ReaderChapterPanelMode;
  modeByMangaId: Record<string, ReaderChapterPanelMode>;
  syncMode: (mangaId: string, defaultMode: ReaderChapterPanelMode) => void;
  setMode: (mangaId: string, mode: ReaderChapterPanelMode) => void;
}

function isReaderChapterPanelMode(value: unknown): value is ReaderChapterPanelMode {
  return value === 'mini' || value === 'normal';
}

function readLegacyReaderChapterPanelState(): Pick<ReaderChapterPanelState, 'preferredMode' | 'modeByMangaId'> {
  let preferredMode: ReaderChapterPanelMode = 'normal';
  let modeByMangaId: Record<string, ReaderChapterPanelMode> = {};

  if (typeof window === 'undefined') {
    return { preferredMode, modeByMangaId };
  }

  try {
    const storedPreferredMode = window.localStorage.getItem(LEGACY_READER_CHAPTER_PANEL_MODE_STORAGE_KEY);
    if (isReaderChapterPanelMode(storedPreferredMode)) {
      preferredMode = storedPreferredMode;
    }

    const storedModeByMangaId = window.localStorage.getItem(LEGACY_READER_CHAPTER_PANEL_MODE_BY_MANGA_STORAGE_KEY);
    if (storedModeByMangaId) {
      const parsed = JSON.parse(storedModeByMangaId);
      if (parsed && typeof parsed === 'object') {
        modeByMangaId = Object.fromEntries(
          Object.entries(parsed).filter(
            (entry): entry is [string, ReaderChapterPanelMode] => isReaderChapterPanelMode(entry[1])
          )
        );
      }
    }
  } catch {
    // ignore storage failures
  }

  return { preferredMode, modeByMangaId };
}

const legacyDefaults = readLegacyReaderChapterPanelState();

export const useReaderChapterPanelStore = create<ReaderChapterPanelState>()(
  persist(
    (set) => ({
      ...legacyDefaults,

      syncMode(mangaId, defaultMode) {
        const id = mangaId.trim();
        if (!id) {
          return;
        }

        set((state) => {
          if (state.modeByMangaId[id]) {
            return state;
          }

          return {
            modeByMangaId: {
              ...state.modeByMangaId,
              [id]: defaultMode
            }
          };
        });
      },

      setMode(mangaId, mode) {
        const id = mangaId.trim();
        if (!id) {
          return;
        }

        set((state) => {
          if (state.modeByMangaId[id] === mode && state.preferredMode === mode) {
            return state;
          }

          return {
            preferredMode: mode,
            modeByMangaId: {
              ...state.modeByMangaId,
              [id]: mode
            }
          };
        });
      }
    }),
    {
      name: READER_CHAPTER_PANEL_STORAGE_KEY,
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state) => ({
        preferredMode: state.preferredMode,
        modeByMangaId: state.modeByMangaId
      })
    }
  )
);
