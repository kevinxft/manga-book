import { useState } from 'react';
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

export function useTagEditor() {
  const [tags, setTags] = useState<TagItem[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);

  const [draftTags, setDraftTags] = useState<TagItem[]>([]);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [newTagLabel, setNewTagLabel] = useState('');
  const [newTagColor, setNewTagColor] = useState<string>(DEFAULT_TAG_COLOR);

  const openTagDialog = () => {
    setDraftTags(tags);
    setEditingTagId(null);
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

    const exists = draftTags.some((tag) => tag.id !== editingTagId && tag.label.toLowerCase() === label.toLowerCase());
    if (exists) return;

    if (editingTagId) {
      setDraftTags((prev) => prev.map((tag) => (tag.id === editingTagId ? { ...tag, label, color: newTagColor } : tag)));
      setEditingTagId(null);
    } else {
      setDraftTags((prev) => [...prev, { id: crypto.randomUUID(), label, color: newTagColor }]);
    }

    setNewTagLabel('');
    setNewTagColor(DEFAULT_TAG_COLOR);
  };

  const removeDraftTag = (id: string) => {
    if (editingTagId === id) {
      setEditingTagId(null);
      setNewTagLabel('');
      setNewTagColor(DEFAULT_TAG_COLOR);
    }
    setDraftTags((prev) => prev.filter((tag) => tag.id !== id));
  };

  const startEditDraftTag = (tag: TagItem) => {
    setEditingTagId(tag.id);
    setNewTagLabel(tag.label);
    setNewTagColor(tag.color);
  };

  const cancelEditDraftTag = () => {
    setEditingTagId(null);
    setNewTagLabel('');
    setNewTagColor(DEFAULT_TAG_COLOR);
  };

  const saveTags = () => {
    setTags(draftTags);
    setSelectedTags((prev) => prev.filter((id) => draftTags.some((tag) => tag.id === id)));
    setTagDialogOpen(false);
  };

  return {
    tags,
    selectedTags,
    tagDialogOpen,
    draftTags,
    editingTagId,
    newTagLabel,
    newTagColor,
    openTagDialog,
    closeTagDialog,
    toggleTagSelection,
    setNewTagLabel,
    setNewTagColor,
    upsertDraftTag,
    removeDraftTag,
    startEditDraftTag,
    cancelEditDraftTag,
    saveTags
  };
}
