import { useEffect, useMemo, useState } from 'react';
import type { MangaBookWithCover, MangaTag } from '@shared/types';
import { ipcInvoke } from '@renderer/ipc/client';
import { useTagStore } from '@renderer/stores/tagStore';

interface UseMangaTagEditorInput {
  hasIpcBridge: boolean;
  updateMangaLocal: (mangaId: string, updater: (manga: MangaBookWithCover) => MangaBookWithCover | null) => void;
  setError: (message: string | null) => void;
}

function isMissingTagHandlerError(message: string): boolean {
  return message.includes('No handler registered for') && message.includes('tag.');
}

export function useMangaTagEditor({ hasIpcBridge, updateMangaLocal, setError }: UseMangaTagEditorInput) {
  const tags = useTagStore((state) => state.tags);
  const ensureLoaded = useTagStore((state) => state.ensureLoaded);
  const upsertTagLocal = useTagStore((state) => state.upsertTagLocal);
  const [addTagDialogOpen, setAddTagDialogOpen] = useState(false);
  const [addTagTarget, setAddTagTarget] = useState<MangaBookWithCover | null>(null);
  const [addTagAnchor, setAddTagAnchor] = useState<{ x: number; y: number } | null>(null);
  const [addTagInput, setAddTagInput] = useState('');
  const [addTagDraft, setAddTagDraft] = useState<string[]>([]);
  const [addTagSaving, setAddTagSaving] = useState(false);
  const [addTagError, setAddTagError] = useState<string | null>(null);

  useEffect(() => {
    void ensureLoaded();
  }, [ensureLoaded, hasIpcBridge]);

  const availableTagNames = useMemo(
    () => Array.from(new Set(tags.map((tag) => tag.label.trim()).filter((name) => name.length > 0))),
    [tags]
  );

  const openAddTagDialog = (item: MangaBookWithCover, anchor: { x: number; y: number }) => {
    if (!hasIpcBridge) {
      setError('当前运行在普通浏览器环境，无法添加标签。请使用 bun run dev 启动 Electron 窗口。');
      return;
    }

    setError(null);
    setAddTagTarget(item);
    setAddTagAnchor(anchor);
    setAddTagInput('');
    setAddTagDraft(Array.from(new Set(item.tags.map((tag) => tag.name.trim()).filter((name) => name.length > 0))));
    setAddTagError(null);
    setAddTagDialogOpen(true);
  };

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

    setError(null);
    setAddTagError(null);
    setAddTagSaving(true);
    try {
      const tagByNameKey = new Map<string, MangaTag>();
      for (const tag of addTagTarget.tags ?? []) {
        const key = tag.name.trim().toLocaleLowerCase();
        if (!key) {
          continue;
        }
        tagByNameKey.set(key, tag);
      }

      for (const tagName of tagsToAdd) {
        const added = await ipcInvoke('tag.addToManga', { mangaId: addTagTarget.id, tagName });
        tagByNameKey.set(tagName.toLocaleLowerCase(), added.tag);
        upsertTagLocal({
          id: added.tag.id,
          label: added.tag.name
        });
      }
      for (const tagName of tagsToRemove) {
        await ipcInvoke('tag.removeFromManga', { mangaId: addTagTarget.id, tagName });
      }

      const fallbackCreatedAt = new Date().toISOString();
      const nextTags = finalTagNames.map((name) => {
        const key = name.toLocaleLowerCase();
        return (
          tagByNameKey.get(key) ?? {
            id: `tag:${key}`,
            name,
            createdAt: fallbackCreatedAt
          }
        );
      });

      updateMangaLocal(addTagTarget.id, (current) => ({
        ...current,
        tags: nextTags
      }));
      closeAddTagDialog(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存标签失败';
      if (isMissingTagHandlerError(message)) {
        setAddTagError('当前 Electron 主进程尚未加载标签功能，请重启 bun run dev 后再试。');
        return;
      }
      setAddTagError(message);
    } finally {
      setAddTagSaving(false);
    }
  };

  return {
    addTagDialogOpen,
    addTagTarget,
    addTagAnchor,
    addTagInput,
    addTagDraft,
    addTagSaving,
    addTagError,
    availableTagNames,
    setAddTagInput,
    openAddTagDialog,
    closeAddTagDialog,
    appendDraftTag,
    removeDraftTag,
    appendInputTag,
    handleConfirmAddTag
  };
}
