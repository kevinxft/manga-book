import { useEffect, useMemo, useRef, useState, memo, useCallback, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDownUp, Folder, FolderTree, Import, Loader2, Pencil, Search, Tags, Trash2, X } from 'lucide-react';
import { Input } from '@renderer/components/ui/input';
import { cn } from '@renderer/lib/utils';
import { useAnchoredMenuPosition } from '@renderer/components/manga/useAnchoredMenuPosition';
import { useOrganizerSelectionStore } from '@renderer/stores/organizerSelectionStore';
import { categoryMatchesSearch, normalizeSearchText } from '../utils';
import type { OrganizerCategory } from '../types';

interface OrganizerCategoryPanelProps {
  categories: OrganizerCategory[];
  moving: boolean;
  creatingAuthor: boolean;
  mergingAuthors: boolean;
  hasIpcBridge: boolean;
  moveError: string | null;
  importingAuthorDirectoryPath: string | null;
  onClearMoveError: () => void;
  onMoveSelected: () => void;
  onRequestImportToCategory: (category: OrganizerCategory) => void;
  onRequestAddAlias: (category: OrganizerCategory) => void;
  onRequestRenameCategory: (category: OrganizerCategory) => void;
  onRequestDeleteCategory: (category: OrganizerCategory) => void;
  onRequestCreateAuthor: () => void;
  onRequestMergeAuthorDirectories: () => void;
}

interface CategoryContextMenuState {
  x: number;
  y: number;
  category: OrganizerCategory;
}

const CategoryItem = memo(function CategoryItem({
  category,
  onSelect,
  onContextMenu
}: {
  category: OrganizerCategory;
  onSelect: (key: string) => void;
  onContextMenu: (event: ReactMouseEvent, category: OrganizerCategory) => void;
}) {
  const active = useOrganizerSelectionStore((state) => state.selectedCategoryKey === category.key);

  return (
    <button
      className={cn(
        'group flex w-full items-center justify-between rounded-2xl border px-2.5 py-2 text-left transition-all duration-200 focus:outline-none',
        active
          ? 'border-blue-500/50 bg-blue-50 shadow-sm'
          : 'border-transparent bg-transparent hover:border-slate-200/60 hover:bg-white hover:shadow-[0_4px_20px_rgba(30,41,59,0.04)]'
      )}
      onClick={() => onSelect(category.key)}
      onContextMenu={(event) => onContextMenu(event, category)}
      title={category.path}
    >
      <span className="inline-flex min-w-0 flex-1 items-center gap-2.5">
        <Folder className={cn('h-4 w-4 shrink-0 transition-colors', active ? 'fill-blue-500/20 text-blue-600' : 'text-blue-400 group-hover:fill-blue-50 group-hover:text-blue-500')} />
        <span className="inline-flex min-w-0 flex-1 flex-col justify-center">
          <span className={cn('truncate text-[13px] font-bold tracking-wide transition-colors', active ? 'text-blue-700' : 'text-slate-700 group-hover:text-slate-900')}>
            {category.label}
          </span>
          {category.aliases.length > 0 ? (
            <span className={cn('truncate text-[10px] font-semibold tracking-wide transition-colors', active ? 'text-blue-500/80' : 'text-slate-400 group-hover:text-slate-500')} title={category.aliases.join(' / ')}>
              {category.aliases.join(' / ')}
            </span>
          ) : null}
        </span>
      </span>
      <span
        className={cn(
          'ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold transition-all',
          active ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
        )}
      >
        {category.count}
      </span>
    </button>
  );
});

const OrganizerMoveButton = memo(function OrganizerMoveButton({
  categories,
  moving,
  hasIpcBridge,
  onMoveSelected
}: {
  categories: OrganizerCategory[];
  moving: boolean;
  hasIpcBridge: boolean;
  onMoveSelected: () => void;
}) {
  const selectedCount = useOrganizerSelectionStore((state) => state.selectedIds.size);
  const selectedCategoryKey = useOrganizerSelectionStore((state) => state.selectedCategoryKey);
  const selectedCategory = useMemo(
    () => categories.find((item) => item.key === selectedCategoryKey) ?? null,
    [categories, selectedCategoryKey]
  );
  const aliasLabel = selectedCategory?.aliases.filter(Boolean).join(' / ') ?? '';

  return (
    <button
      className="group relative flex min-h-[54px] w-full items-center justify-center overflow-hidden rounded-[20px] bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-600 bg-[length:200%_auto] animate-gradient-shift px-5 py-3 text-white shadow-[0_8px_24px_rgba(47,127,230,0.3)] ring-1 ring-white/30 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-[2px] hover:shadow-[0_16px_36px_rgba(47,127,230,0.45)] focus:outline-none focus:ring-4 focus:ring-cyan-400/40 disabled:pointer-events-none disabled:animate-none disabled:bg-none disabled:bg-slate-100 disabled:text-slate-400 disabled:ring-slate-200/50 disabled:shadow-none"
      onClick={onMoveSelected}
      disabled={!hasIpcBridge || moving || selectedCount === 0 || !selectedCategory}
      title={selectedCategory ? `移动到 ${selectedCategory.label}${aliasLabel ? `\n别名：${aliasLabel}` : ''}` : '请选择作者目录'}
    >
      {moving ? <Loader2 className="relative z-20 mr-2 h-4 w-4 shrink-0 animate-spin" /> : null}
      <span className="relative z-20 flex min-w-0 flex-col items-center justify-center">
        <span className="block truncate text-[14px] font-extrabold tracking-wide drop-shadow-sm group-disabled:font-bold group-disabled:drop-shadow-none">
          {selectedCategory ? `移动到 ${selectedCategory.label}` : '移动到所选目录'}
          {selectedCount > 0 ? ` (${selectedCount})` : ''}
        </span>
        {selectedCategory && aliasLabel ? (
          <span className="mt-[3px] block truncate text-[10.5px] font-bold text-blue-100/90 drop-shadow-sm group-disabled:text-slate-400/80 group-disabled:drop-shadow-none">
            别名：{aliasLabel}
          </span>
        ) : null}
      </span>
    </button>
  );
});

export function OrganizerCategoryPanel({
  categories,
  moving,
  creatingAuthor,
  mergingAuthors,
  hasIpcBridge,
  moveError,
  importingAuthorDirectoryPath,
  onClearMoveError,
  onMoveSelected,
  onRequestImportToCategory,
  onRequestAddAlias,
  onRequestRenameCategory,
  onRequestDeleteCategory,
  onRequestCreateAuthor,
  onRequestMergeAuthorDirectories
}: OrganizerCategoryPanelProps) {
  const setSelectedCategoryKey = useOrganizerSelectionStore((state) => state.setSelectedCategoryKey);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<
    'movedDesc' | 'movedAsc' | 'countDesc' | 'countAsc' | 'nameAsc' | 'nameDesc'
  >('movedDesc');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<CategoryContextMenuState | null>(null);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const {
    ref: contextMenuRef,
    position: contextMenuPosition,
    ready: contextMenuReady
  } = useAnchoredMenuPosition({
    open: Boolean(contextMenu),
    anchor: contextMenu ? { x: contextMenu.x, y: contextMenu.y } : null
  });

  const filteredCategories = useMemo(() => {
    const keyword = normalizeSearchText(search);
    const searched = categories.filter((category) => categoryMatchesSearch(category, keyword));

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

  const handleCategoryContextMenu = useCallback((event: ReactMouseEvent, category: OrganizerCategory) => {
    event.preventDefault();
    setSelectedCategoryKey(category.key);
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      category
    });
  }, [setSelectedCategoryKey]);

  const handleCategorySelect = useCallback((key: string) => {
    setSelectedCategoryKey(key);
    setContextMenu(null);
  }, [setSelectedCategoryKey]);

  const renderCategoryList = (items: OrganizerCategory[]) =>
    items.map((category) => (
      <CategoryItem
        key={category.key}
        category={category}
        onSelect={handleCategorySelect}
        onContextMenu={handleCategoryContextMenu}
      />
    ));

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
  }, [contextMenu, contextMenuRef]);

  return (
    <aside className="flex h-full w-[360px] flex-col border-l border-slate-200/50 bg-white/50 backdrop-blur-md">
      <div className="flex min-h-0 flex-1 flex-col border-b border-slate-200/50 px-4 pb-3 pt-5">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="relative min-w-0 flex-1 group">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-500" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={cn(
                'h-10 rounded-full border-slate-200/60 bg-white/60 pl-10 text-[13px] font-medium text-slate-700 shadow-sm transition-all focus:border-blue-500/50 focus:bg-white focus:ring-2 focus:ring-blue-500/20',
                search.trim().length > 0 ? '!pr-8' : 'pr-4'
              )}
              placeholder="搜索"
            />
            {search.trim().length > 0 ? (
              <button
                className="absolute right-2 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-[#70829c] transition hover:bg-[#dfe7f4] hover:text-[#4e607a]"
                onClick={() => setSearch('')}
                title="清空搜索"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          <div className="relative" ref={sortMenuRef}>
            <button
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200/60 bg-white/60 shadow-sm transition-all hover:bg-white hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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

        <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-2 -mr-2 library-sidebar-scroll">
          {filteredCategories.length > 0 ? (
            <section className="space-y-1.5">
              <p className="px-2 text-[11px] font-bold tracking-[0.15em] text-slate-400">AVAILABLE PLACES</p>
              <div className="space-y-1 px-2 pb-2 pt-0.5">{renderCategoryList(filteredCategories)}</div>
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

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            className="group flex h-[42px] w-full items-center justify-center gap-1 rounded-2xl border border-dashed border-slate-300 bg-white/40 text-[13px] font-bold text-slate-500 shadow-sm transition-all hover:border-blue-300 hover:bg-white hover:text-blue-600 hover:shadow disabled:pointer-events-none disabled:bg-slate-50 disabled:opacity-50"
            title="新建归档作者目录"
            onClick={onRequestCreateAuthor}
            disabled={!hasIpcBridge || creatingAuthor}
          >
            {creatingAuthor ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            {!creatingAuthor && <span className="mb-[2px] text-[16px] leading-none transition-transform group-hover:scale-125">+</span>}
            <span>新建归档目录</span>
          </button>
          <button
            className="group flex h-[42px] w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-slate-300 bg-white/40 text-[13px] font-bold text-slate-500 shadow-sm transition-all hover:border-blue-300 hover:bg-white hover:text-blue-600 hover:shadow disabled:pointer-events-none disabled:bg-slate-50 disabled:opacity-50"
            title="合并多个作者目录"
            onClick={onRequestMergeAuthorDirectories}
            disabled={!hasIpcBridge || mergingAuthors || categories.length < 2}
          >
            {mergingAuthors ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderTree className="h-4 w-4 transition-transform group-hover:scale-110" />}
            <span>合并目录</span>
          </button>
        </div>
      </div>

      {moveError ? (
        <div className="shrink-0 px-4 pt-3">
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
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

      <div className="px-4 py-4">
        <OrganizerMoveButton
          categories={categories}
          moving={moving}
          hasIpcBridge={hasIpcBridge}
          onMoveSelected={onMoveSelected}
        />
      </div>

      {contextMenu && typeof document !== 'undefined' ? createPortal(
        <div
          ref={contextMenuRef}
          className="fixed z-[90] w-[210px] rounded-2xl border border-white/60 bg-white/95 p-1.5 shadow-[0_20px_40px_rgba(15,23,42,0.15)] backdrop-blur-xl"
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
              importingAuthorDirectoryPath === contextMenu.category.path
                ? 'cursor-not-allowed text-slate-400'
                : 'text-slate-700 hover:bg-slate-100 hover:text-blue-600'
            )}
            onClick={() => {
              if (importingAuthorDirectoryPath === contextMenu.category.path) {
                return;
              }
              void onRequestImportToCategory(contextMenu.category);
              setContextMenu(null);
            }}
            disabled={importingAuthorDirectoryPath === contextMenu.category.path}
          >
            {importingAuthorDirectoryPath === contextMenu.category.path ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Import className="h-4 w-4" />
            )}
            导入漫画
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
        </div>,
        document.body
      ) : null}
    </aside>
  );
}
