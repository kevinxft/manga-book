import { useState } from 'react';
import type { MangaBookWithCover } from '@shared/types';
import { ipcInvoke } from '@renderer/ipc/client';
import { getErrorMessage } from './error';

interface UseOrganizerTagActionsInput {
  hasIpcBridge: boolean;
  refreshMangas: () => Promise<void>;
  setMoveError: (message: string | null) => void;
}

export function useOrganizerTagActions({ hasIpcBridge, refreshMangas, setMoveError }: UseOrganizerTagActionsInput) {
  const [addTagDialogOpen, setAddTagDialogOpen] = useState(false);
  const [addTagTarget, setAddTagTarget] = useState<MangaBookWithCover | null>(null);
  const [addTagAnchor, setAddTagAnchor] = useState<{ x: number; y: number } | null>(null);
  const [addTagInput, setAddTagInput] = useState('');
  const [addTagDraft, setAddTagDraft] = useState<string[]>([]);
  const [addTagSaving, setAddTagSaving] = useState(false);
  const [addTagError, setAddTagError] = useState<string | null>(null);
  const [availableTagNames, setAvailableTagNames] = useState<string[]>([]);

  const closeAddTagDialog = (force = false) => {
    if (addTagSaving && !force) {
      return;
    }
    setAddTagDialogOpen(false);
    setAddTagTarget(null);
    setAddTagAnchor(null);
    setAddTagInput('');
    setAddTagDraft([]);
    setAddTagError(null);
  };

  const appendDraftTag = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    setAddTagDraft((prev) => {
      if (prev.some((item) => item.toLocaleLowerCase() === trimmed.toLocaleLowerCase())) {
        return prev;
      }
      return [...prev, trimmed];
    });
  };

  const removeDraftTag = (name: string) => {
    const target = name.trim().toLocaleLowerCase();
    setAddTagDraft((prev) => prev.filter((item) => item.toLocaleLowerCase() !== target));
  };

  const appendInputTag = () => {
    const trimmed = addTagInput.trim();
    if (!trimmed) {
      return;
    }
    appendDraftTag(trimmed);
    setAddTagInput('');
  };

  const loadAvailableTagNames = async () => {
    if (!hasIpcBridge) {
      setAvailableTagNames([]);
      return;
    }
    try {
      const items = await ipcInvoke('tag.list', undefined);
      const names = Array.from(new Set(items.map((item) => item.name.trim()).filter((name) => name.length > 0)));
      setAvailableTagNames(names);
    } catch {
      setAvailableTagNames([]);
    }
  };

  const handleAddTagManga = (item: MangaBookWithCover, anchor: { x: number; y: number }) => {
    if (!hasIpcBridge) {
      setMoveError('当前运行在普通浏览器环境，无法添加标签。请使用 bun run dev 启动 Electron 窗口。');
      return;
    }

    setMoveError(null);
    setAddTagTarget(item);
    setAddTagAnchor(anchor);
    setAddTagInput('');
    setAddTagDraft(Array.from(new Set(item.tags.map((tag) => tag.name.trim()).filter((name) => name.length > 0))));
    setAddTagError(null);
    setAddTagDialogOpen(true);
    void loadAvailableTagNames();
  };

  const handleConfirmAddTag = async () => {
    if (!addTagTarget || addTagSaving) {
      return;
    }

    const pendingInput = addTagInput.trim();
    const finalTagNames =
      pendingInput.length > 0
        ? Array.from(
            new Map(
              [...addTagDraft, pendingInput]
                .map((name) => name.trim())
                .filter((name) => name.length > 0)
                .map((name) => [name.toLocaleLowerCase(), name] as const)
            ).values()
          )
        : addTagDraft;
    const currentTagNames = Array.from(
      new Map(
        (addTagTarget.tags ?? [])
          .map((tag) => tag.name.trim())
          .filter((name) => name.length > 0)
          .map((name) => [name.toLocaleLowerCase(), name] as const)
      ).values()
    );
    const currentSet = new Set(currentTagNames.map((name) => name.toLocaleLowerCase()));
    const finalSet = new Set(finalTagNames.map((name) => name.toLocaleLowerCase()));
    const tagsToAdd = finalTagNames.filter((name) => !currentSet.has(name.toLocaleLowerCase()));
    const tagsToRemove = currentTagNames.filter((name) => !finalSet.has(name.toLocaleLowerCase()));

    setAddTagSaving(true);
    setAddTagError(null);
    try {
      for (const tagName of tagsToAdd) {
        await ipcInvoke('tag.addToManga', { mangaId: addTagTarget.id, tagName });
      }
      for (const tagName of tagsToRemove) {
        await ipcInvoke('tag.removeFromManga', { mangaId: addTagTarget.id, tagName });
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('manga-book-tags-updated'));
      }
      await refreshMangas();
      closeAddTagDialog(true);
    } catch (error) {
      const message = getErrorMessage(error, '添加标签失败');
      if (message.includes('No handler registered for') && message.includes('tag.')) {
        setAddTagError('当前 Electron 主进程尚未加载标签功能，请重启 bun run dev 后再试。');
        return;
      }
      setAddTagError(message);
    } finally {
      setAddTagSaving(false);
    }
  };

  return {
    handleAddTagManga,
    addTagDialogOpen,
    addTagTarget,
    addTagAnchor,
    addTagInput,
    setAddTagInput,
    addTagDraft,
    appendInputTag,
    appendDraftTag,
    removeDraftTag,
    addTagSaving,
    addTagError,
    availableTagNames,
    closeAddTagDialog,
    handleConfirmAddTag
  };
}
