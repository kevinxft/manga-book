import { create } from 'zustand';

export type ReaderChapterPanelMode = 'mini' | 'normal';

interface ReaderChapterPanelState {
  modeByMangaId: Record<string, ReaderChapterPanelMode>;
  syncMode: (mangaId: string, hasChapters: boolean) => void;
  setMode: (mangaId: string, mode: ReaderChapterPanelMode) => void;
}

function getDefaultMode(hasChapters: boolean): ReaderChapterPanelMode {
  return hasChapters ? 'normal' : 'mini';
}

export const useReaderChapterPanelStore = create<ReaderChapterPanelState>((set) => ({
  modeByMangaId: {},

  syncMode(mangaId, hasChapters) {
    const id = mangaId.trim();
    if (!id) {
      return;
    }

    const nextMode = getDefaultMode(hasChapters);
    set((state) => {
      if (state.modeByMangaId[id] === nextMode) {
        return state;
      }

      return {
        modeByMangaId: {
          ...state.modeByMangaId,
          [id]: nextMode
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
      if (state.modeByMangaId[id] === mode) {
        return state;
      }

      return {
        modeByMangaId: {
          ...state.modeByMangaId,
          [id]: mode
        }
      };
    });
  }
}));
