import type { DirectoryAlias } from '@shared/types';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import type { OrganizerCategory } from '../types';

interface AliasManagerDialogProps {
  open: boolean;
  targetCategory: OrganizerCategory | null;
  aliasItems: DirectoryAlias[];
  aliasSaving: boolean;
  aliasRemoving: string | null;
  aliasError: string | null;
  onClose: () => void;
  onSubmit: (value: string) => void;
  onRemoveAlias: (alias: string) => void;
}

export function AliasManagerDialog({
  open,
  targetCategory,
  aliasItems,
  aliasSaving,
  aliasRemoving,
  aliasError,
  onClose,
  onSubmit,
  onRemoveAlias
}: AliasManagerDialogProps) {
  const [aliasInput, setAliasInput] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }
    setAliasInput('');
  }, [open, targetCategory?.path]);

  if (!open || !targetCategory) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 p-4">
      <div className="w-full max-w-[440px] rounded-xl border border-[#d3dced] bg-[#f9fbff] p-4 shadow-[0_20px_50px_rgba(20,34,58,0.35)]">
        <p className="text-[15px] font-semibold text-[#1f2f48]">管理别名</p>
        <p className="mt-1 text-[12px] text-[#647792]">
          目标目录：<span className="font-semibold text-[#2e4360]">{targetCategory.label}</span>
        </p>

        <div className="mt-3 rounded-lg border border-[#dde5f1] bg-white/75 p-2.5">
          <p className="text-[11px] font-semibold text-[#7687a0]">已有别名</p>
          {aliasItems.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {aliasItems.map((item) => {
                const removing = aliasRemoving === item.alias;
                return (
                  <span
                    key={item.id}
                    className="inline-flex items-center gap-1 rounded-md bg-[#e8eef8] px-1.5 py-1 text-[11px] font-semibold text-[#355173]"
                  >
                    {item.alias}
                    <button
                      className="inline-flex h-4 w-4 items-center justify-center rounded-sm text-[#607593] transition hover:bg-[#d6e0ef] hover:text-[#29425f]"
                      onClick={() => onRemoveAlias(item.alias)}
                      title="删除别名"
                      disabled={removing || aliasSaving}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="mt-1 text-[11px] text-[#8b9ab0]">暂无别名</p>
          )}
        </div>

        <form
          className="mt-3 space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(aliasInput);
          }}
        >
          <Input
            value={aliasInput}
            onChange={(event) => setAliasInput(event.target.value)}
            className="h-9 rounded-lg border-[#d5deea] bg-white text-[13px]"
            placeholder="输入别名，例如：浅葱"
            autoFocus
          />

          {aliasError ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[12px] text-red-700">
              {aliasError}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              className="h-8 rounded-lg border border-[#d2dbe8] bg-white px-3 text-[12px] font-semibold text-[#4d617f] hover:bg-[#f1f5fb]"
              onClick={onClose}
              disabled={aliasSaving || aliasRemoving !== null}
            >
              取消
            </Button>
            <Button
              type="submit"
              className="h-8 rounded-lg bg-[#2f7fe6] px-3 text-[12px] font-semibold text-white hover:bg-[#236ecc]"
              disabled={aliasSaving || aliasRemoving !== null}
            >
              {aliasSaving ? '保存中...' : '保存别名'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
