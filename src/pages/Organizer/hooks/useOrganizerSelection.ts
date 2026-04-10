import { useEffect, useMemo } from 'react';
import { useOrganizerSelectionStore } from '@renderer/stores/organizerSelectionStore';
import type { OrganizerItem } from '../types';

interface UseOrganizerSelectionArgs {
  visibleItems: OrganizerItem[];
}

export function useOrganizerSelection({ visibleItems }: UseOrganizerSelectionArgs) {
  const toggleItem = useOrganizerSelectionStore((state) => state.toggleItem);
  const setSelectedIds = useOrganizerSelectionStore((state) => state.setSelectedIds);
  const visibleItemIds = useMemo(() => new Set(visibleItems.map((item) => item.id)), [visibleItems]);

  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) {
        return prev;
      }

      const next = new Set<string>();
      let changed = false;

      for (const id of prev) {
        if (visibleItemIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [setSelectedIds, visibleItemIds]);

  return {
    setSelectedIds,
    toggleItem
  };
}
