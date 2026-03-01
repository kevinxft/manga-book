import { Plus, Tag, X } from 'lucide-react';
import { Input } from '@renderer/components/ui/input';
import { cn } from '@renderer/lib/utils';
import type { TagItem } from '../types';
import { getTagTextColor, toRgba } from '../utils';

interface TagManagementDialogProps {
  open: boolean;
  draftTags: TagItem[];
  editingTagId: string | null;
  newTagLabel: string;
  newTagColor: string;
  colorOptions: string[];
  onClose: () => void;
  onSave: () => void;
  onSetNewTagLabel: (value: string) => void;
  onSetNewTagColor: (value: string) => void;
  onUpsertTag: () => void;
  onRemoveTag: (id: string) => void;
  onStartEditTag: (tag: TagItem) => void;
  onCancelEdit: () => void;
}

export function TagManagementDialog({
  open,
  draftTags,
  editingTagId,
  newTagLabel,
  newTagColor,
  colorOptions,
  onClose,
  onSave,
  onSetNewTagLabel,
  onSetNewTagColor,
  onUpsertTag,
  onRemoveTag,
  onStartEditTag,
  onCancelEdit
}: TagManagementDialogProps) {
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
              <p className="text-sm font-semibold text-[#70829d]">共 {draftTags.length} 个标签</p>
            </div>

            {draftTags.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#cfd8e6] bg-white/70 px-4 py-6 text-center text-xs text-[#7f8ea5]">
                暂无标签
              </div>
            ) : (
              <div className="flex flex-wrap gap-2.5">
                {draftTags.map((tag) => (
                  <div
                    key={tag.id}
                    className="flex items-center gap-1.5 rounded-lg border px-1.5 py-1"
                    style={{
                      backgroundColor: toRgba(tag.color, 0.12),
                      borderColor: toRgba(tag.color, 0.35)
                    }}
                  >
                    <button
                      className="min-w-0 rounded-md px-2.5 py-1 text-xs font-semibold transition hover:opacity-90"
                      style={{
                        backgroundColor: tag.color,
                        color: getTagTextColor(tag.color)
                      }}
                      onClick={() => onStartEditTag(tag)}
                      title="点击编辑标签"
                    >
                      <span className="truncate">{tag.label}</span>
                    </button>
                    <button
                      className="rounded-md p-1 text-[#98a7bc] hover:bg-[#f2f6fb] hover:text-[#50617a]"
                      onClick={() => onRemoveTag(tag.id)}
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
            <p className="mb-4 text-base font-extrabold tracking-wide text-[#1d2739]">
              {editingTagId ? '编辑标签' : '新增标签'}
            </p>

            <div className="space-y-2">
              <label className="text-xs font-bold tracking-wide text-[#6d7f99]">标签名称</label>
              <Input
                value={newTagLabel}
                onChange={(event) => onSetNewTagLabel(event.target.value)}
                placeholder="例如：日常 / 热血 / 悬疑"
                className="h-10 rounded-xl border-[#d7deea] bg-white text-sm placeholder:text-[#a3afc2]"
              />
            </div>

            <div className="mt-4 space-y-2.5">
              <label className="text-xs font-bold tracking-wide text-[#6d7f99]">标签颜色</label>
              <div className="flex flex-wrap items-center gap-2.5">
                {colorOptions.map((color) => {
                  const active = color === newTagColor;
                  return (
                    <button
                      key={color}
                      onClick={() => onSetNewTagColor(color)}
                      className={cn(
                        'h-9 w-9 rounded-full border-2 transition',
                        active ? 'border-[#2f6cf6] ring-2 ring-[#c8dcff]' : 'border-transparent'
                      )}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  );
                })}
              </div>
            </div>

            <button
              className="mt-5 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#dfeaf9] text-base font-bold text-[#2f6cf6] transition hover:bg-[#d3e2f8]"
              onClick={onUpsertTag}
            >
              <Plus className="h-5 w-5" />
              {editingTagId ? '保存标签' : '新建标签'}
            </button>

            {editingTagId ? (
              <button
                className="mt-2 flex h-9 w-full items-center justify-center rounded-xl text-xs font-semibold text-[#667891] transition hover:bg-[#e9eef7]"
                onClick={onCancelEdit}
              >
                取消编辑
              </button>
            ) : null}
          </section>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[#dde3ee] px-6 py-4">
          <button
            className="rounded-lg px-4 py-2 text-base font-bold text-[#4a5a72] transition hover:bg-[#e9eef7]"
            onClick={onClose}
          >
            取消
          </button>
          <button
            className="rounded-lg bg-[#2f7fe6] px-5 py-2 text-base font-bold text-white shadow-[0_10px_24px_rgba(47,127,230,0.35)] transition hover:bg-[#236ecc]"
            onClick={onSave}
          >
            保存修改
          </button>
        </div>
      </div>
    </div>
  );
}
