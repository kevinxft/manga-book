import { useEffect, useMemo, useState } from 'react';
import type { OrganizerCategory } from '@renderer/pages/Organizer/types';
import { categoryMatchesSearch, normalizeSearchText } from '@renderer/pages/Organizer/utils';
import { CoverActionSection } from './CoverActionSection';
import { CoverMoveSection, type MoveSortKey } from './CoverMoveSection';
import { useAnchoredMenuPosition } from './useAnchoredMenuPosition';

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
  onEditPages?: (item: T) => void;
  onRename: (item: T) => void;
  onSearchWeb: (item: T, provider: 'hitomi' | 'exhentai' | 'google') => void;
  onOpenInFolder: (mangaId: string) => void;
  onDelete: (item: T) => void;
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

function sortMoveTargets(a: OrganizerCategory, b: OrganizerCategory, sortBy: MoveSortKey): number {
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
}

export function CoverContextMenu<T extends CoverContextMenuItem>({
  menu,
  categories,
  onClose,
  onQuickMove,
  onAddTag,
  onEditPages,
  onRename,
  onSearchWeb,
  onOpenInFolder,
  onDelete
}: CoverContextMenuProps<T>) {
  const [moveSearch, setMoveSearch] = useState('');
  const [moveSortBy, setMoveSortBy] = useState<MoveSortKey>('movedDesc');

  const moveTargets = useMemo(() => {
    if (!menu) {
      return [] as OrganizerCategory[];
    }
    const currentParent = normalizePath(getParentPath(menu.item.folderPath));
    const keyword = normalizeSearchText(moveSearch);

    return categories
      .filter((category) => {
        if (normalizePath(category.path) === currentParent) {
          return false;
        }
        if (keyword.length === 0) {
          return true;
        }
        return categoryMatchesSearch(category, keyword);
      })
      .sort((a, b) => sortMoveTargets(a, b, moveSortBy));
  }, [categories, menu, moveSearch, moveSortBy]);

  const { ref, position, ready, padding } = useAnchoredMenuPosition({
    open: Boolean(menu),
    anchor: menu ? { x: menu.x, y: menu.y } : null,
    contentDependency: moveTargets.length
  });

  useEffect(() => {
    if (!menu) {
      return;
    }
    setMoveSearch('');
    setMoveSortBy('movedDesc');
  }, [menu]);

  useEffect(() => {
    if (!menu) {
      return;
    }

    const closeMenu = (event: MouseEvent) => {
      const target = event.target as Node;
      if (ref.current && !ref.current.contains(target)) {
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
  }, [menu, onClose, ref]);

  if (!menu) {
    return null;
  }

  return (
    <div
      ref={ref}
      className="fixed z-[80] w-[286px] rounded-xl border border-[#d6deea] bg-white p-2 shadow-[0_18px_40px_rgba(30,50,83,0.26)]"
      style={{
        left: position.left,
        top: position.top,
        maxHeight: `calc(100vh - ${padding * 2}px)`,
        visibility: ready ? 'visible' : 'hidden'
      }}
    >
      <CoverMoveSection
        moveSearch={moveSearch}
        moveSortBy={moveSortBy}
        moveTargets={moveTargets}
        itemId={menu.item.id}
        onMoveSearchChange={setMoveSearch}
        onMoveSortChange={setMoveSortBy}
        onQuickMove={onQuickMove}
        onClose={onClose}
      />

      <div className="h-px bg-[#e6ecf5]" />

      <CoverActionSection
        item={menu.item}
        menuAnchor={{ x: position.left, y: position.top }}
        onAddTag={onAddTag}
        onEditPages={onEditPages}
        onRename={onRename}
        onSearchWeb={onSearchWeb}
        onOpenInFolder={onOpenInFolder}
        onDelete={onDelete}
        onClose={onClose}
      />
    </div>
  );
}
