import { useEffect, useMemo, useState } from 'react';
import { Check, FolderTree, Search, X } from 'lucide-react';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import { cn } from '@renderer/lib/utils';
import { categoryMatchesSearch, normalizeSearchText } from '../utils';
import type { OrganizerCategory } from '../types';

interface MergeAuthorDirectoriesDialogProps {
  open: boolean;
  categories: OrganizerCategory[];
  merging: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: { sourceDirectoryPaths: string[]; targetName: string }) => void;
}

export function MergeAuthorDirectoriesDialog({
  open,
  categories,
  merging,
  error,
  onClose,
  onSubmit
}: MergeAuthorDirectoriesDialogProps) {
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [targetName, setTargetName] = useState('');
  const [targetNameTouched, setTargetNameTouched] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedPaths(new Set());
    setTargetName('');
    setTargetNameTouched(false);
    setSearch('');
  }, [open]);

  const selectedCategories = useMemo(
    () =>
      Array.from(selectedPaths)
        .map((path) => categories.find((category) => category.path === path))
        .filter((category): category is OrganizerCategory => Boolean(category)),
    [categories, selectedPaths]
  );

  useEffect(() => {
    if (!open || targetNameTouched) {
      return;
    }

    const firstSelectedName = selectedCategories[0]?.label ?? '';
    if (targetName !== firstSelectedName) {
      setTargetName(firstSelectedName);
    }
  }, [open, selectedCategories, targetName, targetNameTouched]);

  const filteredCategories = useMemo(() => {
    const keyword = normalizeSearchText(search);
    if (!keyword) {
      return categories;
    }

    return categories.filter((category) => categoryMatchesSearch(category, keyword));
  }, [categories, search]);

  const togglePath = (path: string) => {
    setSelectedPaths((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  if (!open) {
    return null;
  }

  const canSubmit = selectedPaths.size >= 2 && targetName.trim().length > 0 && !merging;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[86vh] w-full max-w-[560px] flex-col rounded-xl border border-[#d4dceb] bg-[#f9fbff] p-4 shadow-[0_20px_50px_rgba(20,34,58,0.35)]">
        <p className="text-[15px] font-semibold text-[#1f2f48]">合并作者目录</p>
        <p className="mt-2 text-[12px] leading-5 text-[#5f7088]">
          选择 2 个或更多目录，漫画会合并到最终目录。同名漫画目录会自动追加序号，不会覆盖。
        </p>

        <div className="relative mt-3 group">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-500" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-9 rounded-lg border-[#d5deea] bg-white py-0 pl-9 pr-8 text-[13px] text-slate-700"
            placeholder="搜索要合并的目录或别名"
            disabled={merging}
          />
          {search.trim().length > 0 ? (
            <button
              className="absolute right-2 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-transparent p-0 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              onClick={() => setSearch('')}
              disabled={merging}
              title="清空搜索"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] font-bold text-[#647792]">
          <span>已选择 {selectedPaths.size} 个目录</span>
          <span>{search.trim() ? `匹配 ${filteredCategories.length} 个目录` : selectedCategories.length > 0 ? '旧目录名和别名会转到最终作者下' : ''}</span>
        </div>

        <div className="mt-2 min-h-0 flex-1 overflow-y-auto rounded-lg border border-[#d8e1ee] bg-white/70 p-2">
          <div className="space-y-1.5">
            {filteredCategories.map((category) => {
              const selected = selectedPaths.has(category.path);
              return (
                <div
                  key={category.key}
                  className={cn(
                    'rounded-lg border px-2.5 py-2 transition',
                    selected ? 'border-blue-300 bg-blue-50' : 'border-transparent bg-white hover:border-slate-200'
                  )}
                >
                  <button
                    type="button"
                    className="flex min-w-0 items-center gap-2 bg-transparent p-0 text-left text-[#263956] hover:bg-transparent"
                    onClick={() => togglePath(category.path)}
                    disabled={merging}
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                        selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-transparent'
                      )}
                    >
                      <Check className="h-3 w-3" />
                    </span>
                    <FolderTree className={cn('h-4 w-4 shrink-0', selected ? 'text-blue-600' : 'text-slate-400')} />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-bold">{category.label}</span>
                      {category.aliases.length > 0 ? (
                        <span className="block truncate text-[10px] font-semibold text-slate-400">
                          {category.aliases.join(' / ')}
                        </span>
                      ) : null}
                    </span>
                    <span className="ml-auto shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                      {category.count}
                    </span>
                  </button>

                </div>
              );
            })}
            {filteredCategories.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-[12px] font-semibold text-slate-400">
                没有匹配的目录
              </div>
            ) : null}
          </div>
        </div>

        {error ? (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-2.5 py-2 text-[12px] font-semibold text-red-700">
            {error}
          </p>
        ) : null}

        <div className="mt-3 rounded-lg border border-[#d8e1ee] bg-white/70 px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-bold tracking-wide text-[#647792]">已选目录</p>
            <p className="text-[10px] font-semibold text-slate-400">点击名称作为最终目录名</p>
          </div>
          {selectedCategories.length > 0 ? (
            <div className="mt-2 flex max-h-[72px] flex-wrap gap-1.5 overflow-y-auto pr-1">
              {selectedCategories.map((category) => {
                const activeTarget = targetName.trim() === category.label;
                return (
                  <button
                    key={category.key}
                    type="button"
                    className={cn(
                      'max-w-full rounded-md border px-2 py-1 text-left text-[11px] font-bold transition',
                      activeTarget
                        ? 'border-blue-400 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-600'
                    )}
                    onClick={() => {
                      setTargetNameTouched(true);
                      setTargetName(category.label);
                    }}
                    disabled={merging}
                    title={category.path}
                  >
                    <span className="block max-w-[180px] truncate">{category.label}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="mt-2 text-[12px] font-semibold text-slate-400">还没有选择目录</p>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Input
            value={targetName}
            onChange={(event) => {
              setTargetNameTouched(true);
              setTargetName(event.target.value);
            }}
            className="h-8 min-w-0 flex-1 rounded-lg border-[#d5deea] bg-white text-[12px]"
            placeholder="最终目录名"
            disabled={merging}
          />
          <div className="flex shrink-0 justify-end gap-2">
            <Button
              type="button"
              className="h-8 rounded-lg border border-[#d2dbe8] bg-white px-3 text-[12px] font-semibold text-[#4d617f] hover:bg-[#f1f5fb]"
              onClick={onClose}
              disabled={merging}
            >
              取消
            </Button>
            <Button
              type="button"
              className="h-8 rounded-lg bg-[#2f6cf6] px-3 text-[12px] font-semibold text-white hover:bg-[#2458cc] disabled:opacity-50"
              onClick={() =>
                onSubmit({
                  sourceDirectoryPaths: Array.from(selectedPaths),
                  targetName
                })
              }
              disabled={!canSubmit}
            >
              {merging ? '合并中...' : '确认合并'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
