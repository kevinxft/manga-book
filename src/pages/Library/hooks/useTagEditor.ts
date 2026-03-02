import { useCallback, useEffect, useState } from 'react';
import { ipcInvoke } from '@renderer/ipc/client';
import type { MangaTag } from '@shared/types';
import type { TagItem } from '../types';

function isMissingTagHandlerError(message: string): boolean {
  return message.includes('No handler registered for') && message.includes('tag.');
}

function mapTagToItem(tag: MangaTag): TagItem {
  return {
    id: tag.id,
    label: tag.name
  };
}

export function useTagEditor(hasIpcBridge: boolean) {
  const [tags, setTags] = useState<TagItem[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [newTagLabel, setNewTagLabel] = useState('');

  const refreshTags = useCallback(async () => {
    if (!hasIpcBridge) {
      return;
    }
    try {
      const stored = await ipcInvoke('tag.list', undefined);
      setTags(stored.map(mapTagToItem));
    } catch {
      // ignore tag load errors
    }
  }, [hasIpcBridge]);

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
    setNewTagLabel('');
    setTagDialogOpen(true);
  };

  const closeTagDialog = () => {
    setTagDialogOpen(false);
  };

  const toggleTagSelection = (id: string) => {
    setSelectedTags((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  };

  const clearSelectedTags = () => {
    setSelectedTags([]);
  };

  const upsertDraftTag = () => {
    const label = newTagLabel.trim();
    if (!label) return;
    if (tags.some((tag) => tag.label.toLowerCase() === label.toLowerCase())) {
      return;
    }

    void (async () => {
      if (!hasIpcBridge) {
        setTags((prev) => {
          const next = [...prev, { id: crypto.randomUUID(), label }];
          next.sort((a, b) => a.label.localeCompare(b.label, 'zh-Hans-CN'));
          return next;
        });
        setNewTagLabel('');
        return;
      }

      try {
        const stored = await ipcInvoke('tag.upsert', { name: label });
        setTags((prev) => {
          const next = prev.filter((item) => item.id !== stored.id);
          next.push({
            id: stored.id,
            label: stored.name
          });
          next.sort((a, b) => a.label.localeCompare(b.label, 'zh-Hans-CN'));
          return next;
        });
        setNewTagLabel('');

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('manga-book-tags-updated'));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (isMissingTagHandlerError(message)) {
          setTags((prev) => {
            const next = [...prev, { id: crypto.randomUUID(), label }];
            next.sort((a, b) => a.label.localeCompare(b.label, 'zh-Hans-CN'));
            return next;
          });
          setNewTagLabel('');
          if (typeof window !== 'undefined') {
            window.alert('当前 Electron 主进程尚未加载标签持久化功能，请重启 bun run dev 后再保存标签。');
          }
          return;
        }
        console.error('Create tag failed', error);
        if (typeof window !== 'undefined') {
          window.alert('新建标签失败，请稍后重试。');
        }
      }
    })();
  };

  const removeDraftTag = (id: string) => {
    void (async () => {
      if (!hasIpcBridge) {
        setTags((prev) => prev.filter((tag) => tag.id !== id));
        setSelectedTags((prev) => prev.filter((item) => item !== id));
        return;
      }

      try {
        await ipcInvoke('tag.delete', { id });
        setTags((prev) => prev.filter((tag) => tag.id !== id));
        setSelectedTags((prev) => prev.filter((item) => item !== id));

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('manga-book-tags-updated'));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (isMissingTagHandlerError(message)) {
          setTags((prev) => prev.filter((tag) => tag.id !== id));
          setSelectedTags((prev) => prev.filter((item) => item !== id));
          if (typeof window !== 'undefined') {
            window.alert('当前 Electron 主进程尚未加载标签持久化功能，请重启 bun run dev 后再保存标签。');
          }
          return;
        }
        console.error('Delete tag failed', error);
        if (typeof window !== 'undefined') {
          window.alert('删除标签失败，请稍后重试。');
        }
      }
    })();
  };

  const clearAllTags = () => {
    void (async () => {
      const targetIds = tags.map((tag) => tag.id);
      if (targetIds.length === 0) {
        return;
      }

      if (!hasIpcBridge) {
        setTags([]);
        setSelectedTags([]);
        return;
      }

      try {
        await ipcInvoke('tag.clearAll', undefined);
        setTags([]);
        setSelectedTags([]);

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('manga-book-tags-updated'));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (isMissingTagHandlerError(message)) {
          setTags([]);
          setSelectedTags([]);
          if (typeof window !== 'undefined') {
            window.alert('当前 Electron 主进程尚未加载标签持久化功能，请重启 bun run dev 后再保存标签。');
          }
          return;
        }
        console.error('Clear tags failed', error);
        if (typeof window !== 'undefined') {
          window.alert('清空标签失败，请稍后重试。');
        }
      }
    })();
  };

  return {
    tags,
    selectedTags,
    tagDialogOpen,
    newTagLabel,
    openTagDialog,
    closeTagDialog,
    toggleTagSelection,
    clearSelectedTags,
    setNewTagLabel,
    upsertDraftTag,
    removeDraftTag,
    clearAllTags
  };
}
