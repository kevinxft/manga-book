import { useMemo, useState } from 'react';
import type { DirectoryAlias } from '@shared/types';
import { ipcInvoke } from '@renderer/ipc/client';
import type { OrganizerCategory } from '../types';
import { getErrorMessage } from './error';

interface UseAliasMutationsArgs {
  aliases: DirectoryAlias[];
  upsertAlias: (alias: DirectoryAlias) => void;
  removeAliasLocal: (aliasName: string) => void;
  setMoveError: (message: string | null) => void;
}

export function useAliasMutations({ aliases, upsertAlias, removeAliasLocal, setMoveError }: UseAliasMutationsArgs) {
  const [aliasDialogOpen, setAliasDialogOpen] = useState(false);
  const [aliasTargetCategory, setAliasTargetCategory] = useState<OrganizerCategory | null>(null);
  const [aliasInput, setAliasInput] = useState('');
  const [aliasSaving, setAliasSaving] = useState(false);
  const [aliasRemoving, setAliasRemoving] = useState<string | null>(null);
  const [aliasError, setAliasError] = useState<string | null>(null);

  const aliasTargetItems = useMemo(() => {
    if (!aliasTargetCategory) {
      return [] as DirectoryAlias[];
    }
    const canonicalKey = aliasTargetCategory.label.trim().toLocaleLowerCase();
    return aliases.filter((item) => item.canonicalName.trim().toLocaleLowerCase() === canonicalKey);
  }, [aliasTargetCategory, aliases]);

  const closeAliasDialog = (force = false) => {
    if (aliasSaving && !force) {
      return;
    }
    setAliasDialogOpen(false);
    setAliasTargetCategory(null);
    setAliasInput('');
    setAliasRemoving(null);
    setAliasError(null);
  };

  const handleRequestAddAlias = (canonicalCategory: OrganizerCategory) => {
    setMoveError(null);
    setAliasError(null);
    setAliasInput('');
    setAliasTargetCategory(canonicalCategory);
    setAliasDialogOpen(true);
  };

  const handleConfirmAddAlias = async () => {
    if (!aliasTargetCategory || aliasSaving) {
      return;
    }

    const trimmed = aliasInput.trim();
    if (!trimmed) {
      setAliasError('请输入别名');
      return;
    }

    setAliasSaving(true);
    setAliasError(null);
    setMoveError(null);
    try {
      const storedAlias = await ipcInvoke('organizer.addAlias', {
        alias: trimmed,
        canonicalName: aliasTargetCategory.label
      });
      upsertAlias(storedAlias);
      closeAliasDialog(true);
    } catch (error) {
      const message = getErrorMessage(error, '保存别名失败');
      setAliasError(message);
      setMoveError(message);
    } finally {
      setAliasSaving(false);
    }
  };

  const handleRemoveAlias = async (aliasName: string) => {
    if (!aliasTargetCategory || aliasSaving || aliasRemoving) {
      return;
    }

    setAliasRemoving(aliasName);
    setAliasError(null);
    setMoveError(null);
    try {
      try {
        await ipcInvoke('organizer.removeAlias', { alias: aliasName });
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (message.includes("No handler registered for 'organizer.removeAlias'")) {
          await ipcInvoke('organizer.addAlias', {
            alias: aliasName,
            canonicalName: aliasName
          });
        } else {
          throw error;
        }
      }
      removeAliasLocal(aliasName);
    } catch (error) {
      const message = getErrorMessage(error, '删除别名失败');
      setAliasError(message);
      setMoveError(message);
    } finally {
      setAliasRemoving(null);
    }
  };

  return {
    aliasDialogOpen,
    aliasTargetCategory,
    aliasTargetItems,
    aliasInput,
    setAliasInput,
    aliasSaving,
    aliasRemoving,
    aliasError,
    closeAliasDialog,
    handleRequestAddAlias,
    handleConfirmAddAlias,
    handleRemoveAlias
  };
}
