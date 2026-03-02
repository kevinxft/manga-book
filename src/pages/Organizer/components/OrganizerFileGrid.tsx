import { ArrowDownUp, Eye, FolderInput, FolderOpen, ImageOff, Search, Trash2 } from 'lucide-react';
import { cn } from '@renderer/lib/utils';
import { toCoverSrc } from '@renderer/pages/Library/utils';
import { Input } from '@renderer/components/ui/input';
import type { OrganizerCategory, OrganizerItem } from '../types';
import { useEffect, useMemo, useRef, useState } from 'react';

interface OrganizerFileGridProps {
  loading: boolean;
  error: string | null;
  visibleItems: OrganizerItem[];
  selectedIds: Set<string>;
  categories: OrganizerCategory[];
  onToggleItem: (id: string) => void;
  onQuickMoveManga: (mangaId: string, destinationPath: string) => void;
  onRenameManga: (item: OrganizerItem) => void;
  onOpenInFolder: (mangaId: string) => void;
  onDeleteManga: (item: OrganizerItem) => void;
  onOpenManga?: (item: OrganizerItem) => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  item: OrganizerItem;
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+$/, '');
}

function getParentPath(folderPath: string): string {
  const normalized = normalizePath(folderPath);
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length <= 1) {
    return normalized;
  }
  return `${normalized.startsWith('/') ? '/' : ''}${segments.slice(0, -1).join('/')}`;
}

export function OrganizerFileGrid({
  loading,
  error,
  visibleItems,
  selectedIds,
  categories,
  onToggleItem,
  onQuickMoveManga,
  onRenameManga,
  onOpenInFolder,
  onDeleteManga,
  onOpenManga
}: OrganizerFileGridProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [moveSearch, setMoveSearch] = useState('');
  const [moveSortBy, setMoveSortBy] = useState<
    'recentDesc' | 'recentAsc' | 'countDesc' | 'countAsc' | 'nameAsc' | 'nameDesc'
  >('recentDesc');
  const menuRef = useRef<HTMLDivElement | null>(null);

  const moveTargets = useMemo(() => {
    if (!contextMenu) {
      return [] as OrganizerCategory[];
    }
    const currentParent = normalizePath(getParentPath(contextMenu.item.folderPath));
    const keyword = moveSearch.trim().toLowerCase();
    const filtered = categories.filter((category) => {
      if (normalizePath(category.path) === currentParent) {
        return false;
      }
      if (keyword.length === 0) {
        return true;
      }
      return (
        category.label.toLowerCase().includes(keyword) ||
        category.path.toLowerCase().includes(keyword) ||
        category.aliases.some((alias) => alias.toLowerCase().includes(keyword))
      );
    });

    return filtered.sort((a, b) => {
      if (moveSortBy === 'countDesc') {
        return b.count - a.count || b.latestAddedAt.localeCompare(a.latestAddedAt);
      }
      if (moveSortBy === 'countAsc') {
        return a.count - b.count || a.latestAddedAt.localeCompare(b.latestAddedAt);
      }
      if (moveSortBy === 'nameAsc') {
        return a.label.localeCompare(b.label, 'zh-Hans-CN');
      }
      if (moveSortBy === 'nameDesc') {
        return b.label.localeCompare(a.label, 'zh-Hans-CN');
      }
      if (moveSortBy === 'recentAsc') {
        return a.latestAddedAt.localeCompare(b.latestAddedAt) || a.count - b.count;
      }
      return b.latestAddedAt.localeCompare(a.latestAddedAt) || b.count - a.count;
    });
  }, [categories, contextMenu, moveSearch, moveSortBy]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }
    setMoveSearch('');
    setMoveSortBy('recentDesc');
  }, [contextMenu]);

  useEffect(() => {
    if (!contextMenu) return;

    const closeMenu = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setContextMenu(null);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null);
      }
    };

    window.addEventListener('mousedown', closeMenu);
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', () => setContextMenu(null), { once: true });

    return () => {
      window.removeEventListener('mousedown', closeMenu);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [contextMenu]);

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden border-r border-[#dbe1eb] bg-[#f6f8fc]">
      <div className="min-h-0 flex-1 overflow-auto px-7 py-5">
        {loading ? <p className="text-sm font-semibold text-[#5f6f89]">加载中...</p> : null}

        {!loading && error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        {!loading && !error ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(164px,1fr))] gap-x-4 gap-y-6">
            {visibleItems.map((item) => {
              const isSelected = selectedIds.has(item.id);

              return (
                <article key={item.id} className="group" title={item.displayPath}>
                  <div
                    className={cn(
                      'relative block w-full overflow-hidden rounded-xl border bg-[#d9e0ea] text-left shadow-[0_8px_22px_rgba(42,60,88,0.2)] transition',
                      isSelected
                        ? 'border-[#2f7fe6] ring-2 ring-[#2f7fe6]/45'
                        : 'border-transparent hover:border-[#b7c8df] hover:shadow-[0_12px_28px_rgba(42,60,88,0.24)]'
                    )}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setContextMenu({ x: event.clientX, y: event.clientY, item });
                    }}
                  >
                    <button className="block w-full text-left" onClick={() => onToggleItem(item.id)}>
                      <div className="aspect-[3/4]">
                        {item.coverPath ? (
                          <img
                            src={toCoverSrc(item.coverPath)}
                            alt={item.title}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center bg-[#d3dfef] text-[#6fa4de]">
                            <ImageOff className="h-8 w-8" />
                          </div>
                        )}
                      </div>
                    </button>

                    {item.ownerBadge ? (
                      <span className="absolute left-2 top-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
                        {item.ownerBadge}
                      </span>
                    ) : null}

                    {isSelected ? (
                      <span className="absolute right-2 top-2 rounded-md bg-[#2f7fe6] px-2 py-0.5 text-[10px] font-semibold text-white">
                        已勾选
                      </span>
                    ) : null}

                    <span className="absolute bottom-2 left-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {item.totalPages} 页
                    </span>

                    {onOpenManga ? (
                      <button
                        className="absolute bottom-2 right-2 inline-flex h-6 w-6 items-center justify-center rounded-md bg-black/55 text-white transition hover:bg-black/70"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenManga(item);
                        }}
                        title="预览漫画"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                  <p className="mt-2 truncate text-[14px] font-semibold leading-tight text-[#1a2840]" title={item.title}>
                    {item.title}
                  </p>
                </article>
              );
            })}
          </div>
        ) : null}

        {!loading && !error && visibleItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#c6d2e2] bg-white/70 px-5 py-12 text-center text-sm text-[#6d7f99]">
            当前没有匹配到待整理漫画
          </div>
        ) : null}
      </div>

      {contextMenu ? (
        <div
          ref={menuRef}
          className="fixed z-[80] w-[286px] rounded-xl border border-[#d6deea] bg-white p-2 shadow-[0_18px_40px_rgba(30,50,83,0.26)]"
          style={{ left: contextMenu.x + 6, top: contextMenu.y + 6 }}
        >
          <p className="px-2 pb-1 text-[11px] font-bold tracking-[0.08em] text-[#7b89a1]">快速移动到作者</p>
          <div className="mb-2 grid grid-cols-[1fr_126px] items-center gap-1.5 px-1">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8b98ac]" />
              <Input
                value={moveSearch}
                onChange={(event) => setMoveSearch(event.target.value)}
                className="h-7 rounded-md border-[#d7deeb] bg-[#f3f6fb] pl-7 text-[11px]"
                placeholder="搜索作者/别名"
              />
            </div>
            <label className="relative flex items-center">
              <ArrowDownUp className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-[#7f8da1]" />
              <select
                className="h-7 w-full appearance-none rounded-md border border-[#d7deeb] bg-[#f3f6fb] pl-7 pr-2 text-[11px] font-semibold text-[#4f617d] outline-none"
                value={moveSortBy}
                onChange={(event) => setMoveSortBy(event.target.value as typeof moveSortBy)}
              >
                <option value="recentDesc">最近(新-旧)</option>
                <option value="recentAsc">最近(旧-新)</option>
                <option value="countDesc">本数(多-少)</option>
                <option value="countAsc">本数(少-多)</option>
                <option value="nameAsc">名称(A-Z)</option>
                <option value="nameDesc">名称(Z-A)</option>
              </select>
            </label>
          </div>
          <div className="mb-2 max-h-[260px] space-y-1 overflow-auto rounded-md border border-[#e2e8f3] bg-[#f8fafe] p-1">
            {moveTargets.length > 0 ? (
              moveTargets.map((category) => (
                <button
                  key={category.key}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] font-semibold text-[#28415f] transition hover:bg-[#e7efff]"
                  onClick={() => {
                    onQuickMoveManga(contextMenu.item.id, category.path);
                    setContextMenu(null);
                  }}
                >
                  <FolderInput className="h-3.5 w-3.5 text-[#2f7fe6]" />
                  <span className="inline-flex min-w-0 items-baseline gap-1">
                    <span className="truncate">{category.label}</span>
                    {category.aliases.length > 0 ? (
                      <span className="truncate text-[11px] font-medium text-[#6e7f97]">
                        ({category.aliases.join(' / ')})
                      </span>
                    ) : null}
                  </span>
                </button>
              ))
            ) : (
              <div className="px-2 py-1.5 text-[12px] text-[#8a97ac]">暂无可用目录</div>
            )}
          </div>

          <div className="h-px bg-[#e6ecf5]" />

          <button
            className="mt-2 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] font-semibold text-[#304763] transition hover:bg-[#edf2f9]"
            onClick={() => {
              onRenameManga(contextMenu.item);
              setContextMenu(null);
            }}
          >
            <FolderInput className="h-3.5 w-3.5 text-[#5f708a]" />
            重命名
          </button>

          <button
            className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] font-semibold text-[#304763] transition hover:bg-[#edf2f9]"
            onClick={() => {
              onOpenInFolder(contextMenu.item.id);
              setContextMenu(null);
            }}
          >
            <FolderOpen className="h-3.5 w-3.5 text-[#5f708a]" />
            在文件夹中打开
          </button>

          <button
            className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] font-semibold text-[#ab2f2f] transition hover:bg-[#fff0f0]"
            onClick={() => {
              onDeleteManga(contextMenu.item);
              setContextMenu(null);
            }}
          >
            <Trash2 className="h-3.5 w-3.5 text-[#c73737]" />
            删除漫画
          </button>
        </div>
      ) : null}
    </section>
  );
}
