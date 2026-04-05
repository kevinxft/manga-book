import { create } from 'zustand';
import type { MangaTag } from '@shared/types';
import { ipcInvoke } from '@renderer/ipc/client';
import type { TagItem } from '@renderer/pages/Library/types';

interface TagState {
  tags: TagItem[];
  loaded: boolean;
  error: string | null;
  ensureLoaded: () => Promise<void>;
  refreshTags: () => Promise<void>;
  upsertTag: (label: string) => Promise<TagItem>;
  deleteTag: (id: string) => Promise<void>;
  clearAllTags: () => Promise<void>;
  upsertTagLocal: (tag: TagItem | MangaTag) => void;
  deleteTagLocal: (id: string) => void;
  clearAllTagsLocal: () => void;
}

let tagLoadPromise: Promise<void> | null = null;

function hasIpcBridge(): boolean {
  return typeof window !== 'undefined' && typeof window.mangaBookApi?.invoke === 'function';
}

function isMissingTagHandlerError(message: string): boolean {
  return message.includes('No handler registered for') && message.includes('tag.');
}

function mapTagToItem(tag: TagItem | MangaTag): TagItem {
  if ('label' in tag) {
    return tag;
  }

  return {
    id: tag.id,
    label: tag.name
  };
}

function upsertAndSortTags(tags: TagItem[], nextTag: TagItem): TagItem[] {
  const next = tags.filter((item) => item.id !== nextTag.id);
  next.push(nextTag);
  next.sort((first, second) => first.label.localeCompare(second.label, 'zh-Hans-CN'));
  return next;
}

export const useTagStore = create<TagState>((set, get) => ({
  tags: [],
  loaded: false,
  error: null,

  async ensureLoaded() {
    if (get().loaded) {
      return;
    }

    if (!hasIpcBridge()) {
      set({ loaded: true, error: null });
      return;
    }

    await get().refreshTags();
  },

  async refreshTags() {
    if (!hasIpcBridge()) {
      set({ loaded: true, error: null });
      return;
    }

    if (tagLoadPromise) {
      return tagLoadPromise;
    }

    tagLoadPromise = (async () => {
      try {
        const stored = await ipcInvoke('tag.list', undefined);
        set({
          tags: stored.map(mapTagToItem),
          loaded: true,
          error: null
        });
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to load tags'
        });
      } finally {
        tagLoadPromise = null;
      }
    })();

    return tagLoadPromise;
  },

  async upsertTag(label) {
    const trimmed = label.trim();
    if (!trimmed) {
      throw new Error('Tag name is required');
    }

    if (!hasIpcBridge()) {
      const created = {
        id: crypto.randomUUID(),
        label: trimmed
      };
      get().upsertTagLocal(created);
      return created;
    }

    try {
      const stored = await ipcInvoke('tag.upsert', { name: trimmed });
      const next = mapTagToItem(stored);
      get().upsertTagLocal(next);
      return next;
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (isMissingTagHandlerError(message)) {
        const fallback = {
          id: crypto.randomUUID(),
          label: trimmed
        };
        get().upsertTagLocal(fallback);
        return fallback;
      }
      throw error;
    }
  },

  async deleteTag(id) {
    if (!hasIpcBridge()) {
      get().deleteTagLocal(id);
      return;
    }

    try {
      await ipcInvoke('tag.delete', { id });
      get().deleteTagLocal(id);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (isMissingTagHandlerError(message)) {
        get().deleteTagLocal(id);
        return;
      }
      throw error;
    }
  },

  async clearAllTags() {
    if (get().tags.length === 0) {
      return;
    }

    if (!hasIpcBridge()) {
      get().clearAllTagsLocal();
      return;
    }

    try {
      await ipcInvoke('tag.clearAll', undefined);
      get().clearAllTagsLocal();
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (isMissingTagHandlerError(message)) {
        get().clearAllTagsLocal();
        return;
      }
      throw error;
    }
  },

  upsertTagLocal(tag) {
    const nextTag = mapTagToItem(tag);

    set((state) => ({
      tags: upsertAndSortTags(state.tags, nextTag),
      loaded: true,
      error: null
    }));
  },

  deleteTagLocal(id) {
    set((state) => ({
      tags: state.tags.filter((item) => item.id !== id),
      loaded: true,
      error: null
    }));
  },

  clearAllTagsLocal() {
    set({
      tags: [],
      loaded: true,
      error: null
    });
  }
}));
