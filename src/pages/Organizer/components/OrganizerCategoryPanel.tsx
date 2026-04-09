import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownUp, Folder, Loader2, Pencil, Search, Tags, Trash2, X } from 'lucide-react';
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
  onRequestDeleteCategory: (category: OrganizerCategory) => void;
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
  onRequestDeleteCategory,
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
            'group flex w-full items-center justify-between rounded-[14px] border px-3 py-2.5 text-left transition-all duration-200 shadow-sm',
            active
              ? 'border-blue-500 bg-blue-500 shadow-blue-500/25'
              : 'border-transparent bg-slate-50 hover:bg-white hover:border-slate-200/60 hover:-translate-y-0.5 hover:shadow-md'
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
          <span className="inline-flex min-w-0 items-center gap-2.5">
            <Folder className={cn('h-4 w-4 transition-colors', active ? 'text-white' : 'text-blue-500 group-hover:text-blue-600')} />
            <span className="inline-flex min-w-0 items-baseline gap-1">
              <span className={cn('truncate text-[13px] font-bold tracking-wide transition-colors', active ? 'text-white' : 'text-slate-700 group-hover:text-blue-600')}>
                {label}
              </span>
              {aliasText ? (
                <span
                  className={cn(
                    'truncate text-[11px] font-medium tracking-wide transition-colors',
                    active ? 'text-white/80' : 'text-slate-400 group-hover:text-slate-500'
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
              'rounded-lg px-2 py-0.5 text-[11px] font-bold shadow-sm transition-colors',
              active ? 'bg-white/20 text-white shadow-none ring-1 ring-white/30' : 'bg-slate-200/70 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:ring-1 group-hover:ring-blue-200'
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
    <aside className="flex h-full w-[360px] flex-col border-l border-slate-200/50 bg-white/50 backdrop-blur-md">
      <div className="flex min-h-0 flex-1 flex-col border-b border-slate-200/50 px-6 pb-4 pt-6">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="relative min-w-0 flex-1 group">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-500" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-10 rounded-xl border-slate-200/60 bg-white/60 pl-10 pr-9 text-[13px] font-medium text-slate-700 shadow-sm transition-all focus:border-blue-500/50 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
              placeholder="搜索可用目录..."
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
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/60 bg-white/60 shadow-sm transition-all hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              onClick={() => setSortMenuOpen((prev) => !prev)}
              title="排序"
            >
              <ArrowDownUp className="h-4 w-4 text-slate-500" />
            </button>

            {sortMenuOpen ? (
              <div className="absolute right-0 top-12 z-30 w-48 rounded-2xl border border-white/60 bg-white/95 p-1.5 shadow-[0_16px_40px_rgba(15,23,42,0.15)] backdrop-blur-xl">
                {[
                  { key: 'movedDesc' as const, label: '最近移入(新-旧)' },
                  { key: 'movedAsc' as const, label: '最近移入(旧-新)' },
                  { key: 'countDesc' as const, label: '漫画本数(多-少)' },
                  { key: 'countAsc' as const, label: '漫画本数(少-多)' },
                  { key: 'nameAsc' as const, label: '按名称(A-Z)' },
                  { key: 'nameDesc' as const, label: '按名称(Z-A)' }
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => {
                      setSortBy(item.key);
                      setSortMenuOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center rounded-xl px-3 py-2.5 text-left text-[12px] font-bold tracking-wide transition-all duration-200',
                      sortBy === item.key ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-2.5 overflow-auto pr-2 -mr-2">
          {filteredCategories.length > 0 ? (
            <section className="space-y-1.5">
              <p className="px-1 text-[11px] font-bold tracking-[0.15em] text-slate-400">AVAILABLE PLACES</p>
              <div className="space-y-1.5">{renderCategoryList(filteredCategories)}</div>
            </section>
          ) : null}

          {categories.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/40 px-4 py-8 text-center text-[13px] font-bold text-slate-500 shadow-sm">
              暂无可用目录<br/><span className="text-[11px] font-medium text-slate-400">请点击下方新建</span>
            </div>
          ) : null}

          {categories.length > 0 && filteredCategories.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/40 px-4 py-8 text-center text-[13px] font-bold text-slate-500 shadow-sm">
              没有匹配的目录
            </div>
          ) : null}
        </div>

        <Button
          className="mt-4 h-11 w-full rounded-2xl border border-dashed border-slate-300 bg-white/60 text-[13px] font-bold text-slate-600 shadow-sm transition-all hover:bg-white hover:text-blue-600 hover:border-blue-300"
          title="新建归档作者目录"
          onClick={onRequestCreateAuthor}
          disabled={!hasIpcBridge || creatingAuthor}
        >
          {creatingAuthor ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          + 新建归档目录
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

      <div className="px-6 py-5">
        <Button
          className="h-12 w-full rounded-2xl bg-blue-600 text-[15px] font-bold tracking-wide text-white shadow-md shadow-blue-500/25 transition-all duration-300 hover:bg-blue-500 hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0 disabled:bg-slate-300 disabled:text-slate-500"
          onClick={onMoveSelected}
          disabled={!hasIpcBridge || moving || selectedCount === 0 || !selectedCategory}
        >
          {moving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
          移动到所选目录 ({selectedCount})
        </Button>
      </div>

      {contextMenu ? (
        <div
          ref={contextMenuRef}
          className="fixed z-[90] w-[180px] rounded-2xl border border-white/60 bg-white/95 p-1.5 shadow-[0_20px_40px_rgba(15,23,42,0.15)] backdrop-blur-xl"
          style={{
            left: contextMenuPosition.left,
            top: contextMenuPosition.top,
            visibility: contextMenuReady ? 'visible' : 'hidden'
          }}
        >
          <button
            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-bold text-slate-700 transition-all hover:bg-slate-100 hover:text-blue-600"
            onClick={() => {
              onRequestRenameCategory(contextMenu.category);
              setContextMenu(null);
            }}
          >
            <Pencil className="h-4 w-4" />
            重命名目录
          </button>
          <button
            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-bold text-slate-700 transition-all hover:bg-slate-100 hover:text-blue-600"
            onClick={() => {
              onRequestAddAlias(contextMenu.category);
              setContextMenu(null);
            }}
          >
            <Tags className="h-4 w-4" />
            添加匹配别名
          </button>
          <button
            className={cn(
              'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-bold transition-all',
              contextMenu.category.count === 0
                ? 'text-red-600 hover:bg-red-50'
                : 'cursor-not-allowed text-slate-400'
            )}
            onClick={() => {
              if (contextMenu.category.count > 0) {
                return;
              }
              onRequestDeleteCategory(contextMenu.category);
              setContextMenu(null);
            }}
            disabled={contextMenu.category.count > 0}
            title={contextMenu.category.count > 0 ? '仅可删除不包含漫画的归档目录' : '删除该目录'}
          >
            <Trash2 className="h-4 w-4" />
            删除空目录
          </button>
        </div>
      ) : null}
    </aside>
  );
}
