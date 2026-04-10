import { create } from 'zustand';

interface OrganizerSelectionState {
  selectedIds: Set<string>;
  selectedCategoryKey: string | null;

  toggleItem: (id: string) => void;
  setSelectedIds: (updater: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  setSelectedCategoryKey: (key: string | null) => void;
}

function areSetsEqual(first: Set<string>, second: Set<string>): boolean {
  if (first === second) {
    return true;
  }

  if (first.size !== second.size) {
    return false;
  }

  for (const value of first) {
    if (!second.has(value)) {
      return false;
    }
  }

  return true;
}

export const useOrganizerSelectionStore = create<OrganizerSelectionState>((set) => ({
  selectedIds: new Set(),
  selectedCategoryKey: null,

  toggleItem(id) {
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { selectedIds: next };
    });
  },

  setSelectedIds(updater) {
    set((state) => {
      const next = typeof updater === 'function' ? updater(state.selectedIds) : updater;
      return areSetsEqual(state.selectedIds, next) ? state : { selectedIds: next };
    });
  },

  setSelectedCategoryKey(key) {
    set((state) => (state.selectedCategoryKey === key ? state : { selectedCategoryKey: key }));
  }
}));
