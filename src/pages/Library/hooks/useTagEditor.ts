import { useEffect, useState } from 'react';
import { useLibraryStore } from '@renderer/stores/libraryStore';
import { useTagStore } from '@renderer/stores/tagStore';

export function useTagEditor(hasIpcBridge: boolean) {
  const tags = useTagStore((state) => state.tags);
  const ensureLoaded = useTagStore((state) => state.ensureLoaded);
  const upsertTag = useTagStore((state) => state.upsertTag);
  const deleteTag = useTagStore((state) => state.deleteTag);
  const clearAllGlobalTags = useTagStore((state) => state.clearAllTags);
  const updateAllMangasLocal = useLibraryStore((state) => state.updateAllMangasLocal);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [newTagLabel, setNewTagLabel] = useState('');

  useEffect(() => {
    void ensureLoaded();
  }, [ensureLoaded, hasIpcBridge]);

  useEffect(() => {
    const knownTagIds = new Set(tags.map((tag) => tag.id));
    setSelectedTags((prev) => prev.filter((id) => knownTagIds.has(id)));
  }, [tags]);

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
      try {
        await upsertTag(label);
        setNewTagLabel('');
      } catch (error) {
        console.error('Create tag failed', error);
        if (typeof window !== 'undefined') {
          window.alert('新建标签失败，请稍后重试。');
        }
      }
    })();
  };

  const removeDraftTag = (id: string) => {
    void (async () => {
      const removedTag = tags.find((tag) => tag.id === id) ?? null;

      try {
        await deleteTag(id);
        setSelectedTags((prev) => prev.filter((item) => item !== id));
        if (removedTag) {
          const removedLabelKey = removedTag.label.trim().toLocaleLowerCase();
          updateAllMangasLocal((manga) => {
            const nextTags = manga.tags.filter(
              (tag) => tag.id !== removedTag.id && tag.name.trim().toLocaleLowerCase() !== removedLabelKey
            );

            return nextTags.length === manga.tags.length ? manga : { ...manga, tags: nextTags };
          });
        }
      } catch (error) {
        console.error('Delete tag failed', error);
        if (typeof window !== 'undefined') {
          window.alert('删除标签失败，请稍后重试。');
        }
      }
    })();
  };

  const clearAllTags = () => {
    void (async () => {
      if (tags.length === 0) {
        return;
      }

      try {
        await clearAllGlobalTags();
        setSelectedTags([]);
        updateAllMangasLocal((manga) => (manga.tags.length === 0 ? manga : { ...manga, tags: [] }));
      } catch (error) {
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
