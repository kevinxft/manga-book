import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownUp, Folder, Loader2, Pencil, Search, Tags, X } from 'lucide-react';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import { cn } from '@renderer/lib/utils';
import type { OrganizerCategory } from '../types';

interface OrganizerCategoryPanelProps {
  categories: OrganizerCategory[];
  selectedCategoryKey: string | null;
  selectedCount: number;
  moving: boolean;
  creatingAuthor: boolean;
  hasIpcBridge: boolean;
  moveError: string | null;
  onClearMoveError: () => void;
  onSelectCategory: (key: string) => void;
  onMoveSelected: () => void;
  onRequestAddAlias: (category: OrganizerCategory) => void;
  onRequestRenameCategory: (category: OrganizerCategory) => void;
  onRequestCreateAuthor: () => void;
}

interface CategoryContextMenuState {
  x: number;
  y: number;
  category: OrganizerCategory;
}

const CONTEXT_MENU_OFFSET = 6;
const CONTEXT_MENU_PADDING = 8;

export function OrganizerCategoryPanel({
  categories,
  selectedCategoryKey,
  selectedCount,
  moving,
  creatingAuthor,
  hasIpcBridge,
  moveError,
  onClearMoveError,
  onSelectCategory,
  onMoveSelected,
  onRequestAddAlias,
  onRequestRenameCategory,
  onRequestCreateAuthor
}: OrganizerCategoryPanelProps) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<
    'movedDesc' | 'movedAsc' | 'countDesc' | 'countAsc' | 'nameAsc' | 'nameDesc'
  >('movedDesc');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<CategoryContextMenuState | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState({ left: 0, top: 0 });
  const [contextMenuReady, setContextMenuReady] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  const selectedCategory = categories.find((item) => item.key === selectedCategoryKey) ?? null;
  const filteredCategories = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const searched = categories.filter(
      (category) =>
        keyword.length === 0 ||
        category.label.toLowerCase().includes(keyword) ||
        category.aliases.some((alias) => alias.toLowerCase().includes(keyword))
    );

    return [...searched].sort((a, b) => {
      const compareByMovedAt = (asc: boolean) => {
        const aMoved = a.lastMovedAt;
        const bMoved = b.lastMovedAt;
        const aHas = Boolean(aMoved);
        const bHas = Boolean(bMoved);

        if (aHas !== bHas) {
          return aHas ? -1 : 1;
        }
        if (aMoved && bMoved) {
          return asc ? aMoved.localeCompare(bMoved) : bMoved.localeCompare(aMoved);
        }
        return b.latestAddedAt.localeCompare(a.latestAddedAt) || b.count - a.count;
      };

      if (sortBy === 'movedDesc') {
        return compareByMovedAt(false);
      }
      if (sortBy === 'movedAsc') {
        return compareByMovedAt(true);
      }
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
      return compareByMovedAt(false);
    });
  }, [categories, search, sortBy]);

  const renderCategoryList = (items: OrganizerCategory[]) =>
    items.map((category) => {
      const active = category.key === selectedCategoryKey;
      const label = category.label;
      const aliasText = category.aliases.length > 0 ? `(${category.aliases.join(' / ')})` : null;

      return (
        <button
          key={category.key}
          className={cn(
            'flex w-full items-center justify-between rounded-xl border px-2.5 py-2 text-left transition',
            active
              ? 'border-[#2f7fe6] bg-[#2f7fe6] shadow-[0_8px_18px_rgba(47,127,230,0.34)]'
              : 'border-transparent hover:bg-[#e8edf6]'
          )}
          onClick={() => {
            onSelectCategory(category.key);
            setContextMenu(null);
          }}
          onContextMenu={(event) => {
            event.preventDefault();
            onSelectCategory(category.key);
            setContextMenu({
              x: event.clientX,
              y: event.clientY,
              category
            });
          }}
          title={category.path}
        >
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <Folder className={cn('h-3.5 w-3.5', active ? 'text-white' : 'text-[#2f7fe6]')} />
            <span className="inline-flex min-w-0 items-baseline gap-0.5">
              <span className={cn('truncate text-[12px] font-semibold', active ? 'text-white' : 'text-[#1f2f48]')}>
                {label}
              </span>
              {aliasText ? (
                <span
                  className={cn(
                    'truncate text-[11px] font-medium',
                    active ? 'text-white/80' : 'text-[#71839d]'
                  )}
                  title={category.aliases.join(' / ')}
                >
                  {aliasText}
                </span>
              ) : null}
            </span>
          </span>
          <span
            className={cn(
              'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
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

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    const closeMenu = (event: MouseEvent) => {
      const target = event.target as Node;
      if (contextMenuRef.current && !contextMenuRef.current.contains(target)) {
        setContextMenu(null);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null);
      }
    };

    const closeOnResize = () => {
      setContextMenu(null);
    };

    window.addEventListener('mousedown', closeMenu);
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', closeOnResize, { once: true });

    return () => {
      window.removeEventListener('mousedown', closeMenu);
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', closeOnResize);
    };
  }, [contextMenu]);

  useLayoutEffect(() => {
    if (!contextMenu) {
      setContextMenuReady(false);
      return;
    }

    const updatePosition = () => {
      if (!contextMenuRef.current) {
        return;
      }

      const rect = contextMenuRef.current.getBoundingClientRect();
      const desiredLeft = contextMenu.x + CONTEXT_MENU_OFFSET;
      const desiredTop = contextMenu.y + CONTEXT_MENU_OFFSET;
      const maxLeft = Math.max(CONTEXT_MENU_PADDING, window.innerWidth - rect.width - CONTEXT_MENU_PADDING);
      const maxTop = Math.max(CONTEXT_MENU_PADDING, window.innerHeight - rect.height - CONTEXT_MENU_PADDING);

      setContextMenuPosition({
        left: Math.min(Math.max(desiredLeft, CONTEXT_MENU_PADDING), maxLeft),
        top: Math.min(Math.max(desiredTop, CONTEXT_MENU_PADDING), maxTop)
      });
      setContextMenuReady(true);
    };

    setContextMenuReady(false);
    const frame = window.requestAnimationFrame(updatePosition);
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [contextMenu]);

  return (
    <aside className="flex h-full w-[340px] flex-col bg-[#f1f3f7]">
      <div className="flex min-h-0 flex-1 flex-col border-b border-[#dbe1eb] px-5 pb-4 pt-5">
        <div className="mb-3 flex items-center gap-2">
          <h3 className="shrink-0 text-[18px] font-bold text-[#1a2940]">整理目录</h3>

          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b98ac]" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-9 rounded-lg border-[#d6deea] bg-[#eef2f8] pl-9 pr-9 text-[12px]"
              placeholder="搜索目录..."
            />
            {search.trim().length > 0 ? (
              <button
                className="absolute right-2 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md text-[#70829c] transition hover:bg-[#dfe7f4] hover:text-[#4e607a]"
                onClick={() => setSearch('')}
                title="清空搜索"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
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
                  { key: 'movedDesc' as const, label: '最近移入(新-旧)' },
                  { key: 'movedAsc' as const, label: '最近移入(旧-新)' },
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

        <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-1">
          {filteredCategories.length > 0 ? (
            <section className="space-y-1">
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

        <Button
          className="mt-3 h-10 w-full rounded-xl border border-dashed border-[#b9c8de] bg-white/70 text-[13px] font-semibold text-[#4f6484] hover:bg-white"
          title="新建作者目录"
          onClick={onRequestCreateAuthor}
          disabled={!hasIpcBridge || creatingAuthor}
        >
          {creatingAuthor ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
          + 新建作者
        </Button>
      </div>

      {moveError ? (
        <div className="shrink-0 px-5 pt-4">
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
            <p className="min-w-0 flex-1 break-words">{moveError}</p>
            <button
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-red-500 transition hover:bg-red-100 hover:text-red-700"
              onClick={onClearMoveError}
              title="关闭错误提示"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
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

      {contextMenu ? (
        <div
          ref={contextMenuRef}
          className="fixed z-[90] w-[172px] rounded-lg border border-[#d6deea] bg-white p-1.5 shadow-[0_14px_30px_rgba(36,54,86,0.24)]"
          style={{
            left: contextMenuPosition.left,
            top: contextMenuPosition.top,
            visibility: contextMenuReady ? 'visible' : 'hidden'
          }}
        >
          <button
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] font-semibold text-[#304763] transition hover:bg-[#edf2f9]"
            onClick={() => {
              onRequestRenameCategory(contextMenu.category);
              setContextMenu(null);
            }}
          >
            <Pencil className="h-3.5 w-3.5 text-[#627694]" />
            重命名作者
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] font-semibold text-[#304763] transition hover:bg-[#edf2f9]"
            onClick={() => {
              onRequestAddAlias(contextMenu.category);
              setContextMenu(null);
            }}
          >
            <Tags className="h-3.5 w-3.5 text-[#627694]" />
            添加别名
          </button>
        </div>
      ) : null}
    </aside>
  );
}
