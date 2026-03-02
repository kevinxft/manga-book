import { useEffect, useState } from 'react';
import { Plus, Tag, X } from 'lucide-react';
import { Input } from '@renderer/components/ui/input';
import { Button } from '@renderer/components/ui/button';
import type { TagItem } from '../types';

interface TagManagementDialogProps {
  open: boolean;
  tags: TagItem[];
  newTagLabel: string;
  onClose: () => void;
  onSetNewTagLabel: (value: string) => void;
  onUpsertTag: () => void;
  onRemoveTag: (id: string) => void;
  onClearAllTags: () => void;
}

export function TagManagementDialog({
  open,
  tags,
  newTagLabel,
  onClose,
  onSetNewTagLabel,
  onUpsertTag,
  onRemoveTag,
  onClearAllTags
}: TagManagementDialogProps) {
  const [pendingDeleteTag, setPendingDeleteTag] = useState<TagItem | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  useEffect(() => {
    if (!open) {
      setPendingDeleteTag(null);
      setConfirmClearAll(false);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#7f8899]/65 px-4 py-8">
      <div className="w-full max-w-[780px] overflow-hidden rounded-2xl border border-[#d7dde8] bg-[#f4f6fa] shadow-[0_24px_72px_rgba(39,53,73,0.35)]">
        <div className="flex items-center justify-between border-b border-[#dde3ee] px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#deebff]">
              <Tag className="h-5 w-5 text-[#2f6cf6]" />
            </div>
            <h2 className="text-xl font-bold leading-none text-[#111b2d]">管理标签</h2>
          </div>
          <button
            className="rounded-md p-1.5 text-[#7a869b] transition hover:bg-[#e8edf5] hover:text-[#4d5d75]"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          <section>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-base font-extrabold tracking-wide text-[#1d2739]">当前标签</p>
              <div className="flex items-center gap-3">
                <p className="text-sm font-semibold text-[#70829d]">共 {tags.length} 个标签</p>
                <Button
                  type="button"
                  className="h-7 rounded-md border border-[#f0bcbc] bg-[#fff2f2] px-2.5 text-[11px] font-semibold text-[#b83b3b] hover:bg-[#ffe7e7]"
                  disabled={tags.length === 0}
                  onClick={() => setConfirmClearAll(true)}
                >
                  清除全部标签
                </Button>
              </div>
            </div>

            {tags.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#cfd8e6] bg-white/70 px-4 py-6 text-center text-xs text-[#7f8ea5]">
                暂无标签
              </div>
            ) : (
              <div className="flex flex-wrap gap-2.5">
                {tags.map((tag) => (
                  <div key={tag.id} className="flex items-center gap-1.5 rounded-lg border border-[#ced8e8] bg-white px-2 py-1">
                    <span className="min-w-0 rounded-md bg-[#ebf2ff] px-2.5 py-1 text-xs font-semibold text-[#325074]">
                      <span className="truncate">{tag.label}</span>
                    </span>
                    <button
                      className="rounded-md p-1 text-[#98a7bc] hover:bg-[#f2f6fb] hover:text-[#50617a]"
                      onClick={() => setPendingDeleteTag(tag)}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="h-px bg-[#dde3ee]" />

          <section>
            <p className="mb-4 text-base font-extrabold tracking-wide text-[#1d2739]">新增标签</p>

            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                onUpsertTag();
              }}
            >
              <label className="text-xs font-bold tracking-wide text-[#6d7f99]">标签名称</label>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Input
                  value={newTagLabel}
                  onChange={(event) => onSetNewTagLabel(event.target.value)}
                  placeholder="例如：日常 / 热血 / 悬疑"
                  className="h-10 rounded-xl border-[#d7deea] bg-white text-sm placeholder:text-[#a3afc2]"
                />
                <Button
                  type="submit"
                  className="h-10 rounded-xl bg-[#dfeaf9] px-3 text-[13px] font-bold text-[#2f6cf6] transition hover:bg-[#d3e2f8]"
                >
                  <Plus className="mr-1 h-4 w-4" />
                  新建标签
                </Button>
              </div>
            </form>
          </section>
        </div>
      </div>

      {pendingDeleteTag ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-[360px] rounded-xl border border-[#d4dceb] bg-[#f9fbff] p-4 shadow-[0_20px_50px_rgba(20,34,58,0.35)]">
            <p className="text-[14px] font-semibold text-[#1f2f48]">确认删除标签？</p>
            <p className="mt-2 text-[12px] leading-5 text-[#5f7088]">删除后会从所有漫画中移除该标签。</p>
            <p className="mt-2 rounded-md bg-[#eef3fb] px-2.5 py-2 text-[12px] font-semibold text-[#2e4360]">
              {pendingDeleteTag.label}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                className="h-8 rounded-lg border border-[#d2dbe8] bg-white px-3 text-[12px] font-semibold text-[#4d617f] hover:bg-[#f1f5fb]"
                onClick={() => setPendingDeleteTag(null)}
              >
                取消
              </Button>
              <Button
                type="button"
                className="h-8 rounded-lg bg-[#c73a3a] px-3 text-[12px] font-semibold text-white hover:bg-[#a83131]"
                onClick={() => {
                  onRemoveTag(pendingDeleteTag.id);
                  setPendingDeleteTag(null);
                }}
              >
                确认删除
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmClearAll ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-[380px] rounded-xl border border-[#d4dceb] bg-[#f9fbff] p-4 shadow-[0_20px_50px_rgba(20,34,58,0.35)]">
            <p className="text-[14px] font-semibold text-[#1f2f48]">确认清除全部标签？</p>
            <p className="mt-2 text-[12px] leading-5 text-[#5f7088]">这会删除全部全局标签，并从所有漫画移除这些标签。</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                className="h-8 rounded-lg border border-[#d2dbe8] bg-white px-3 text-[12px] font-semibold text-[#4d617f] hover:bg-[#f1f5fb]"
                onClick={() => setConfirmClearAll(false)}
              >
                取消
              </Button>
              <Button
                type="button"
                className="h-8 rounded-lg bg-[#c73a3a] px-3 text-[12px] font-semibold text-white hover:bg-[#a83131]"
                onClick={() => {
                  onClearAllTags();
                  setConfirmClearAll(false);
                }}
              >
                确认清除
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
