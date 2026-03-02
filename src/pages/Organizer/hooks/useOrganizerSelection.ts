import { useMemo, useState } from 'react';
import type { OrganizerItem } from '../types';

interface UseOrganizerSelectionArgs {
  visibleItems: OrganizerItem[];
}

export function useOrganizerSelection({ visibleItems }: UseOrganizerSelectionArgs) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const allVisibleSelected = useMemo(() => {
    if (visibleItems.length === 0) {
      return false;
    }
    return visibleItems.every((item) => selectedIds.has(item.id));
  }, [selectedIds, visibleItems]);

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (visibleItems.length > 0 && visibleItems.every((item) => next.has(item.id))) {
        visibleItems.forEach((item) => next.delete(item.id));
      } else {
        visibleItems.forEach((item) => next.add(item.id));
      }
      return next;
    });
  };

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return {
    selectedIds,
    setSelectedIds,
    allVisibleSelected,
    toggleSelectAllVisible,
    toggleItem
  };
}
