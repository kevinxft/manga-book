import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownUp, Folder, Loader2, Search } from 'lucide-react';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import { cn } from '@renderer/lib/utils';
import type { OrganizerCategory } from '../types';

interface OrganizerCategoryPanelProps {
  categories: OrganizerCategory[];
  selectedCategoryKey: string | null;
  selectedCount: number;
  moving: boolean;
  hasIpcBridge: boolean;
  moveError: string | null;
  onSelectCategory: (key: string) => void;
  onMoveSelected: () => void;
  onRequestAddAlias: (category: OrganizerCategory) => void;
}

export function OrganizerCategoryPanel({
  categories,
  selectedCategoryKey,
  selectedCount,
  moving,
  hasIpcBridge,
  moveError,
  onSelectCategory,
  onMoveSelected,
  onRequestAddAlias
}: OrganizerCategoryPanelProps) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<
    'recentDesc' | 'recentAsc' | 'countDesc' | 'countAsc' | 'nameAsc' | 'nameDesc'
  >('recentDesc');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);

  const selectedCategory = categories.find((item) => item.key === selectedCategoryKey) ?? null;
  const filteredCategories = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const searched = categories.filter(
      (category) =>
        keyword.length === 0 ||
        category.label.toLowerCase().includes(keyword) ||
        category.path.toLowerCase().includes(keyword)
    );

    return [...searched].sort((a, b) => {
      if (sortBy === 'countDesc') {
        return b.count - a.count || b.latestAddedAt.localeCompare(a.latestAddedAt);
      }
      if (sortBy === 'countAsc') {
        return a.count - b.count || a.latestAddedAt.localeCompare(b.latestAddedAt);
      }
      if (sortBy === 'nameAsc') {
        return a.label.localeCompare(b.label, 'zh-Hans-CN');
      }
      if (sortBy === 'nameDesc') {
        return b.label.localeCompare(a.label, 'zh-Hans-CN');
      }
      if (sortBy === 'recentAsc') {
        return a.latestAddedAt.localeCompare(b.latestAddedAt) || a.count - b.count;
      }
      return b.latestAddedAt.localeCompare(a.latestAddedAt) || b.count - a.count;
    });
  }, [categories, search, sortBy]);

  const renderCategoryList = (items: OrganizerCategory[]) =>
    items.map((category) => {
      const active = category.key === selectedCategoryKey;
      const label = category.label;

      return (
        <button
          key={category.key}
          className={cn(
            'flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition',
            active
              ? 'border-[#2f7fe6] bg-[#2f7fe6] shadow-[0_8px_18px_rgba(47,127,230,0.34)]'
              : 'border-transparent hover:bg-[#e8edf6]'
          )}
          onClick={() => onSelectCategory(category.key)}
          onContextMenu={(event) => {
            event.preventDefault();
            onRequestAddAlias(category);
          }}
          title={category.path}
        >
          <span className="inline-flex min-w-0 items-center gap-2">
            <Folder className={cn('h-4 w-4', active ? 'text-white' : 'text-[#2f7fe6]')} />
            <span className={cn('truncate text-[13px] font-semibold', active ? 'text-white' : 'text-[#1f2f48]')}>
              {label}
            </span>
          </span>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[11px] font-bold',
              active ? 'bg-white/24 text-white' : 'bg-[#e5ebf5] text-[#6f7f98]'
            )}
          >
            {category.count}
          </span>
        </button>
      );
    });

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (sortMenuRef.current && !sortMenuRef.current.contains(target)) {
        setSortMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, []);

  return (
    <aside className="flex h-full w-[340px] flex-col bg-[#f1f3f7]">
      <div className="flex min-h-0 flex-1 flex-col border-b border-[#dbe1eb] px-5 pb-4 pt-5">
        <div className="mb-3">
          <div>
            <h3 className="text-[18px] font-bold text-[#1a2940]">整理目录</h3>
            <p className="mt-0.5 text-[11px] font-semibold text-[#8a98ad]">右键目录可添加别名</p>
          </div>
        </div>

        <div className="mb-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b98ac]" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-9 rounded-lg border-[#d6deea] bg-[#eef2f8] pl-9 text-[12px]"
                placeholder="搜索目录..."
              />
            </div>

            <div className="relative" ref={sortMenuRef}>
              <button
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#dce2ec] bg-[#eceff4] text-[#5f6c80] hover:bg-[#e2e7f0]"
                onClick={() => setSortMenuOpen((prev) => !prev)}
                title="排序"
              >
                <ArrowDownUp className="h-4 w-4 text-[#5e6c80]" />
              </button>

              {sortMenuOpen ? (
                <div className="absolute right-0 top-10 z-30 w-44 rounded-lg border border-[#d6deea] bg-white p-1.5 shadow-[0_14px_28px_rgba(48,68,99,0.18)]">
                  {[
                    { key: 'recentDesc' as const, label: '最近导入(新-旧)' },
                    { key: 'recentAsc' as const, label: '最近导入(旧-新)' },
                    { key: 'countDesc' as const, label: '漫画本数(多-少)' },
                    { key: 'countAsc' as const, label: '漫画本数(少-多)' },
                    { key: 'nameAsc' as const, label: '名称(A-Z)' },
                    { key: 'nameDesc' as const, label: '名称(Z-A)' }
                  ].map((item) => (
                    <button
                      key={item.key}
                      onClick={() => {
                        setSortBy(item.key);
                        setSortMenuOpen(false);
                      }}
                      className={cn(
                        'flex w-full items-center rounded-md px-2.5 py-2 text-left text-xs font-semibold transition',
                        sortBy === item.key ? 'bg-[#e7efff] text-[#2f6cf6]' : 'text-[#4f5d73] hover:bg-[#edf2f9]'
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-auto pr-1">
          {filteredCategories.length > 0 ? (
            <section className="space-y-1.5">
              <p className="px-1 text-[11px] font-bold tracking-[0.1em] text-[#7f8ea6]">ARTISTS</p>
              {renderCategoryList(filteredCategories)}
            </section>
          ) : null}

          {categories.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#c7d2e4] bg-white/60 px-3 py-5 text-center text-xs text-[#7a8ca7]">
              暂无可用目录
            </div>
          ) : null}

          {categories.length > 0 && filteredCategories.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#c7d2e4] bg-white/60 px-3 py-5 text-center text-xs text-[#7a8ca7]">
              没有匹配的目录
            </div>
          ) : null}
        </div>

        <button
          className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#b9c8de] text-[13px] font-semibold text-[#647793] opacity-60"
          title="新建分类（即将支持）"
          disabled
        >
          + 新建分类
        </button>
      </div>

      {moveError ? (
        <div className="shrink-0 px-5 pt-4">
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">{moveError}</p>
        </div>
      ) : null}

      <div className="border-t border-[#dbe1eb] px-5 py-4">
        <Button
          className="h-11 w-full rounded-xl bg-[#2f7fe6] text-[15px] font-semibold text-white hover:bg-[#236ecc]"
          onClick={onMoveSelected}
          disabled={!hasIpcBridge || moving || selectedCount === 0 || !selectedCategory}
        >
          {moving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          移动到所选目录 ({selectedCount})
        </Button>
      </div>
    </aside>
  );
}
