import { useCallback, useEffect, useState } from 'react';
import { ipcInvoke } from '@renderer/ipc/client';
import type { MangaTag } from '@shared/types';
import type { TagItem } from '../types';

export const TAG_COLOR_OPTIONS = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#6366f1',
  '#a855f7',
  '#ec4899',
  '#1e293b'
] as const;

export const DEFAULT_TAG_COLOR = '#ef4444';
const TAG_COLOR_MAP_STORAGE_KEY = 'manga-book-tag-colors-v1';

function isMissingTagHandlerError(message: string): boolean {
  return message.includes('No handler registered for') && message.includes('tag.');
}

function hashLabel(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function readTagColorMap(): Record<string, string> {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(TAG_COLOR_MAP_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeTagColorMap(map: Record<string, string>): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(TAG_COLOR_MAP_STORAGE_KEY, JSON.stringify(map));
}

function resolveTagColor(tag: MangaTag, colorMap: Record<string, string>): string {
  const existing = colorMap[tag.id];
  if (existing) {
    return existing;
  }
  const fallbackIndex = hashLabel(tag.name) % TAG_COLOR_OPTIONS.length;
  return TAG_COLOR_OPTIONS[fallbackIndex] ?? DEFAULT_TAG_COLOR;
}

function mapTagToItem(tag: MangaTag, colorMap: Record<string, string>): TagItem {
  return {
    id: tag.id,
    label: tag.name,
    color: resolveTagColor(tag, colorMap)
  };
}

export function useTagEditor(hasIpcBridge: boolean) {
  const [tags, setTags] = useState<TagItem[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);

  const [draftTags, setDraftTags] = useState<TagItem[]>([]);
  const [newTagLabel, setNewTagLabel] = useState('');
  const [newTagColor, setNewTagColor] = useState<string>(DEFAULT_TAG_COLOR);
  const [tagColorMap, setTagColorMap] = useState<Record<string, string>>(() => readTagColorMap());

  const refreshTags = useCallback(async () => {
    if (!hasIpcBridge) {
      return;
    }
    try {
      const stored = await ipcInvoke('tag.list', undefined);
      setTags(stored.map((tag) => mapTagToItem(tag, tagColorMap)));
    } catch {
      // ignore tag load errors
    }
  }, [hasIpcBridge, tagColorMap]);

  useEffect(() => {
    if (!hasIpcBridge) {
      return;
    }
    void refreshTags();
  }, [hasIpcBridge, refreshTags]);

  useEffect(() => {
    if (typeof window === 'undefined' || !hasIpcBridge) {
      return;
    }
    const handleTagUpdated = () => {
      void refreshTags();
    };
    window.addEventListener('manga-book-tags-updated', handleTagUpdated);
    return () => window.removeEventListener('manga-book-tags-updated', handleTagUpdated);
  }, [hasIpcBridge, refreshTags]);

  const openTagDialog = () => {
    setDraftTags(tags);
    setNewTagLabel('');
    setNewTagColor(DEFAULT_TAG_COLOR);
    setTagDialogOpen(true);
  };

  const closeTagDialog = () => {
    setTagDialogOpen(false);
  };

  const toggleTagSelection = (id: string) => {
    setSelectedTags((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  };

  const upsertDraftTag = () => {
    const label = newTagLabel.trim();
    if (!label) return;

    const exists = draftTags.some((tag) => tag.label.toLowerCase() === label.toLowerCase());
    if (exists) return;

    setDraftTags((prev) => [...prev, { id: crypto.randomUUID(), label, color: newTagColor }]);
    setNewTagLabel('');
    setNewTagColor(DEFAULT_TAG_COLOR);
  };

  const removeDraftTag = (id: string) => {
    setDraftTags((prev) => prev.filter((tag) => tag.id !== id));
  };

  const saveTags = () => {
    void (async () => {
      if (!hasIpcBridge) {
        setTags(draftTags);
        setSelectedTags((prev) => prev.filter((id) => draftTags.some((tag) => tag.id === id)));
        setTagDialogOpen(false);
        return;
      }

      try {
        const nextColorMap = { ...tagColorMap };
        const persistedTags: TagItem[] = [];
        for (const draftTag of draftTags) {
          const stored = await ipcInvoke('tag.upsert', { name: draftTag.label });
          nextColorMap[stored.id] = draftTag.color || DEFAULT_TAG_COLOR;
          persistedTags.push({
            id: stored.id,
            label: stored.name,
            color: nextColorMap[stored.id] ?? DEFAULT_TAG_COLOR
          });
        }

        const keepIds = new Set(persistedTags.map((tag) => tag.id));
        for (const currentTag of tags) {
          if (!keepIds.has(currentTag.id)) {
            await ipcInvoke('tag.delete', { id: currentTag.id });
            delete nextColorMap[currentTag.id];
          }
        }

        writeTagColorMap(nextColorMap);
        setTagColorMap(nextColorMap);
        setTags(persistedTags);
        setSelectedTags((prev) => prev.filter((id) => persistedTags.some((tag) => tag.id === id)));
        setTagDialogOpen(false);

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('manga-book-tags-updated'));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (isMissingTagHandlerError(message)) {
          setTags(draftTags);
          setSelectedTags((prev) => prev.filter((id) => draftTags.some((tag) => tag.id === id)));
          setTagDialogOpen(false);
          if (typeof window !== 'undefined') {
            window.alert('当前 Electron 主进程尚未加载标签持久化功能，请重启 bun run dev 后再保存标签。');
          }
          return;
        }
        console.error('Save tags failed', error);
        if (typeof window !== 'undefined') {
          window.alert('保存标签失败，请稍后重试。');
        }
      }
    })();
  };

  return {
    tags,
    selectedTags,
    tagDialogOpen,
    draftTags,
    newTagLabel,
    newTagColor,
    openTagDialog,
    closeTagDialog,
    toggleTagSelection,
    setNewTagLabel,
    setNewTagColor,
    upsertDraftTag,
    removeDraftTag,
    saveTags
  };
}
