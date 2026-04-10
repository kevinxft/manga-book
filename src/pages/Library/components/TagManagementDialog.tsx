import { useEffect, useState } from 'react';
import { Plus, Tag, X } from 'lucide-react';
import { cn } from '@renderer/lib/utils';
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
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const timer = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
      const timer = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      setPendingDeleteTag(null);
      setConfirmClearAll(false);
    }
  }, [open]);

  if (!mounted) {
    return null;
  }

  return (
    <div 
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm",
        "transition-all duration-300 ease-out",
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
    >
      <div 
        className={cn(
          "w-full max-w-[420px] overflow-hidden rounded-[28px] border border-white/60 bg-white/90 shadow-[0_24px_60px_rgba(15,23,42,0.15)] ring-1 ring-slate-200/50 backdrop-blur-2xl",
          "transition-all duration-300 ease-out",
          visible ? "scale-100 opacity-100 translate-y-0" : "scale-95 opacity-0 translate-y-4"
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-200/50 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 shadow-sm ring-1 ring-blue-500/10">
              <Tag className="h-4 w-4 text-blue-600" />
            </div>
            <h2 className="text-[15px] font-bold leading-none tracking-wide text-slate-800">标签管理</h2>
          </div>
          <button
            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-600 focus:bg-slate-100 focus:outline-none"
            onClick={onClose}
            title="关闭窗口"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-5 px-5 py-4">
          <section className="flex flex-col min-h-0">
            <div className="mb-2.5 flex items-center justify-between px-1">
              <p className="text-[12px] font-bold tracking-wider text-slate-400">当前全局标签 ({tags.length})</p>
              {tags.length > 0 ? (
                <button
                  type="button"
                  className="rounded-full border border-red-200 bg-red-50/50 px-2 py-0.5 text-[10px] font-bold text-red-500 transition-colors hover:bg-red-100 hover:text-red-700"
                  onClick={() => setConfirmClearAll(true)}
                >
                  清空全部
                </button>
              ) : null}
            </div>

            {tags.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200/60 bg-slate-50/50 py-6 text-center text-[12px] font-bold text-slate-400 shadow-sm">
                暂无使用任何标签
              </div>
            ) : (
              <div className="library-sidebar-scroll flex max-h-[160px] flex-wrap gap-2 overflow-y-auto px-1 pb-1">
                {tags.map((tag) => (
                  <div
                    key={tag.id}
                    className="group flex max-w-full items-center gap-1 rounded-full border border-slate-200/80 bg-white pl-2.5 pr-1 py-1 shadow-sm transition-all hover:border-blue-200 hover:shadow"
                  >
                    <span className="truncate text-[12px] font-bold tracking-wide text-slate-600 transition-colors group-hover:text-blue-600">
                      {tag.label}
                    </span>
                    <button
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-slate-300 transition-all hover:bg-red-100 hover:text-red-500"
                      onClick={() => setPendingDeleteTag(tag)}
                      title="删除此标签"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="h-px shrink-0 bg-slate-200/60" />

          <section className="shrink-0">
            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (newTagLabel.trim()) {
                  onUpsertTag();
                }
              }}
            >
              <Input
                value={newTagLabel}
                onChange={(event) => onSetNewTagLabel(event.target.value)}
                placeholder="在此输入新标签名称..."
                className="h-9 flex-1 rounded-full border-slate-200/60 bg-slate-50 pl-4 pr-4 text-[12px] font-medium text-slate-700 shadow-sm transition-all placeholder:text-slate-400 focus:border-blue-500/50 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
              />
              <Button
                type="submit"
                disabled={!newTagLabel.trim()}
                className="h-9 shrink-0 rounded-full bg-blue-600 px-4 text-[12px] font-bold tracking-wide text-white shadow-sm shadow-blue-500/20 transition-all hover:-translate-y-0.5 hover:bg-blue-500 hover:shadow-md disabled:pointer-events-none disabled:opacity-50"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                新增
              </Button>
            </form>
          </section>
        </div>
      </div>

      {pendingDeleteTag ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[320px] rounded-[24px] border border-white/60 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.2)] ring-1 ring-slate-200/50 backdrop-blur-2xl">
            <p className="text-center text-[15px] font-black tracking-wide text-slate-800">确认删除标签？</p>
            <p className="mt-2 text-center text-[12px] font-medium leading-relaxed text-slate-500">
              这意味着该标签将从所有的漫画属性中被彻底剔除。
            </p>
            <div className="mx-auto mt-4 w-fit max-w-full truncate rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[12px] font-bold text-blue-600">
              {pendingDeleteTag.label}
            </div>
            <div className="mt-6 flex gap-3">
              <Button
                type="button"
                variant="secondary"
                className="h-9 flex-1 rounded-full bg-slate-100 text-[13px] font-bold text-slate-600 hover:bg-slate-200"
                onClick={() => setPendingDeleteTag(null)}
              >
                取消
              </Button>
              <Button
                type="button"
                className="h-9 flex-1 rounded-full bg-red-500 text-[13px] font-bold text-white shadow-sm shadow-red-500/20 hover:bg-red-400"
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[320px] rounded-[24px] border border-white/60 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.2)] ring-1 ring-slate-200/50 backdrop-blur-2xl">
            <p className="text-center text-[15px] font-black tracking-wide text-red-600">清空全部标签</p>
            <p className="mt-2 text-center text-[12px] font-medium leading-relaxed text-slate-500">
              您确定要删除所有全局标签吗？这会清空系统内所有漫画的标签信息且不可恢复。
            </p>
            <div className="mt-6 flex gap-3">
              <Button
                type="button"
                variant="secondary"
                className="h-9 flex-1 rounded-full bg-slate-100 text-[13px] font-bold text-slate-600 hover:bg-slate-200"
                onClick={() => setConfirmClearAll(false)}
              >
                取消
              </Button>
              <Button
                type="button"
                className="h-9 flex-1 rounded-full bg-red-500 text-[13px] font-bold text-white shadow-sm shadow-red-500/20 hover:bg-red-400"
                onClick={() => {
                  onClearAllTags();
                  setConfirmClearAll(false);
                }}
              >
                确认清空
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
