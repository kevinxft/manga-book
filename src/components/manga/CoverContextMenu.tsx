import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownUp, ExternalLink, FolderInput, FolderOpen, Search, Tag, Trash2 } from 'lucide-react';
import { Input } from '@renderer/components/ui/input';
import type { OrganizerCategory } from '@renderer/pages/Organizer/types';

export interface CoverContextMenuItem {
  id: string;
  folderPath: string;
}

export interface CoverContextMenuState<T extends CoverContextMenuItem> {
  x: number;
  y: number;
  item: T;
}

interface CoverContextMenuProps<T extends CoverContextMenuItem> {
  menu: CoverContextMenuState<T> | null;
  categories: OrganizerCategory[];
  onClose: () => void;
  onQuickMove: (mangaId: string, destinationPath: string) => void;
  onAddTag: (item: T, anchor: { x: number; y: number }) => void;
  onRename: (item: T) => void;
  onSearchWeb: (item: T, provider: 'hitomi' | 'exhentai' | 'google') => void;
  onOpenInFolder: (mangaId: string) => void;
  onDelete: (item: T) => void;
}

type MoveSortKey = 'recentDesc' | 'recentAsc' | 'countDesc' | 'countAsc' | 'nameAsc' | 'nameDesc';
const MENU_OFFSET = 6;
const VIEWPORT_PADDING = 8;

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

export function CoverContextMenu<T extends CoverContextMenuItem>({
  menu,
  categories,
  onClose,
  onQuickMove,
  onAddTag,
  onRename,
  onSearchWeb,
  onOpenInFolder,
  onDelete
}: CoverContextMenuProps<T>) {
  const [moveSearch, setMoveSearch] = useState('');
  const [moveSortBy, setMoveSortBy] = useState<MoveSortKey>('recentDesc');
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0 });
  const [menuReady, setMenuReady] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const moveTargets = useMemo(() => {
    if (!menu) {
      return [] as OrganizerCategory[];
    }
    const currentParent = normalizePath(getParentPath(menu.item.folderPath));
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
  }, [categories, menu, moveSearch, moveSortBy]);

  useEffect(() => {
    if (!menu) {
      return;
    }
    setMoveSearch('');
    setMoveSortBy('recentDesc');
  }, [menu]);

  useEffect(() => {
    if (!menu) {
      return;
    }

    const closeMenu = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        onClose();
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('mousedown', closeMenu);
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', onClose, { once: true });

    return () => {
      window.removeEventListener('mousedown', closeMenu);
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', onClose);
    };
  }, [menu, onClose]);

  useLayoutEffect(() => {
    if (!menu) {
      setMenuReady(false);
      return;
    }

    const updateMenuPosition = () => {
      if (!menuRef.current) {
        return;
      }

      const rect = menuRef.current.getBoundingClientRect();
      const desiredLeft = menu.x + MENU_OFFSET;
      const desiredTop = menu.y + MENU_OFFSET;
      const maxLeft = Math.max(VIEWPORT_PADDING, window.innerWidth - rect.width - VIEWPORT_PADDING);
      const maxTop = Math.max(VIEWPORT_PADDING, window.innerHeight - rect.height - VIEWPORT_PADDING);

      setMenuPosition({
        left: Math.min(Math.max(desiredLeft, VIEWPORT_PADDING), maxLeft),
        top: Math.min(Math.max(desiredTop, VIEWPORT_PADDING), maxTop)
      });
      setMenuReady(true);
    };

    setMenuReady(false);
    const frame = window.requestAnimationFrame(updateMenuPosition);

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [menu, moveTargets.length]);

  if (!menu) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-[80] w-[286px] rounded-xl border border-[#d6deea] bg-white p-2 shadow-[0_18px_40px_rgba(30,50,83,0.26)]"
      style={{
        left: menuPosition.left,
        top: menuPosition.top,
        maxHeight: `calc(100vh - ${VIEWPORT_PADDING * 2}px)`,
        visibility: menuReady ? 'visible' : 'hidden'
      }}
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
            onChange={(event) => setMoveSortBy(event.target.value as MoveSortKey)}
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
                onQuickMove(menu.item.id, category.path);
                onClose();
              }}
            >
              <FolderInput className="h-3.5 w-3.5 text-[#2f7fe6]" />
              <span className="inline-flex min-w-0 items-baseline gap-1">
                <span className="truncate">{category.label}</span>
                {category.aliases.length > 0 ? (
                  <span className="truncate text-[11px] font-medium text-[#6e7f97]">({category.aliases.join(' / ')})</span>
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
          onAddTag(menu.item, { x: menuPosition.left, y: menuPosition.top });
          onClose();
        }}
      >
        <Tag className="h-3.5 w-3.5 text-[#5f708a]" />
        编辑标签
      </button>

      <button
        className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] font-semibold text-[#304763] transition hover:bg-[#edf2f9]"
        onClick={() => {
          onRename(menu.item);
          onClose();
        }}
      >
        <FolderInput className="h-3.5 w-3.5 text-[#5f708a]" />
        重命名
      </button>

      <button
        className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] font-semibold text-[#304763] transition hover:bg-[#edf2f9]"
        onClick={() => {
          onSearchWeb(menu.item, 'hitomi');
          onClose();
        }}
      >
        <ExternalLink className="h-3.5 w-3.5 text-[#5f708a]" />
        Hitomi 搜索
      </button>

      <button
        className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] font-semibold text-[#304763] transition hover:bg-[#edf2f9]"
        onClick={() => {
          onSearchWeb(menu.item, 'exhentai');
          onClose();
        }}
      >
        <ExternalLink className="h-3.5 w-3.5 text-[#5f708a]" />
        ExHentai 搜索
      </button>

      <button
        className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] font-semibold text-[#304763] transition hover:bg-[#edf2f9]"
        onClick={() => {
          onSearchWeb(menu.item, 'google');
          onClose();
        }}
      >
        <ExternalLink className="h-3.5 w-3.5 text-[#5f708a]" />
        Google 搜索
      </button>

      <button
        className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] font-semibold text-[#304763] transition hover:bg-[#edf2f9]"
        onClick={() => {
          onOpenInFolder(menu.item.id);
          onClose();
        }}
      >
        <FolderOpen className="h-3.5 w-3.5 text-[#5f708a]" />
        在文件夹中打开
      </button>

      <button
        className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] font-semibold text-[#ab2f2f] transition hover:bg-[#fff0f0]"
        onClick={() => {
          onDelete(menu.item);
          onClose();
        }}
      >
        <Trash2 className="h-3.5 w-3.5 text-[#c73737]" />
        删除漫画
      </button>
    </div>
  );
}
