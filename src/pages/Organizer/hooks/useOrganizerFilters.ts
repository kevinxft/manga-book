import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import type { OrganizerItem, OrganizerSortKey, OrganizerSourceFilterOption, OrganizerStatusFilter } from '../types';
import { filterAndSortOrganizerItems } from '../utils';

interface UseOrganizerFiltersArgs {
  organizerItems: OrganizerItem[];
}

export function useOrganizerFilters({ organizerItems }: UseOrganizerFiltersArgs) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrganizerStatusFilter>('unorganized');
  const [sortBy, setSortBy] = useState<OrganizerSortKey>('addedAt');
  const [sourceFilter, setSourceFilter] = useState('all');
  const deferredQuery = useDeferredValue(query);

  const sourceOptions = useMemo<OrganizerSourceFilterOption[]>(() => {
    const segmentsByPath = new Map<string, string[]>();
    const countsByLeaf = new Map<string, number>();

    for (const item of organizerItems) {
      const normalized = item.sourceFolderPath.trim();
      if (!normalized || segmentsByPath.has(normalized)) {
        continue;
      }

      const segments = normalized.replace(/\\/g, '/').split('/').filter(Boolean);
      segmentsByPath.set(normalized, segments);

      const leaf = (segments[segments.length - 1] ?? normalized).trim();
      countsByLeaf.set(leaf, (countsByLeaf.get(leaf) ?? 0) + 1);
    }

    return [...segmentsByPath.entries()]
      .map(([path, segments]) => {
        const leaf = (segments[segments.length - 1] ?? path).trim();
        const parent = segments[segments.length - 2]?.trim();
        const duplicateLeaf = (countsByLeaf.get(leaf) ?? 0) > 1;

        return {
          path,
          label: duplicateLeaf && parent ? `${leaf} · ${parent}` : leaf || path
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label, 'zh-Hans-CN'));
  }, [organizerItems]);

  useEffect(() => {
    if (sourceFilter === 'all') {
      return;
    }

    if (!sourceOptions.some((option) => option.path === sourceFilter)) {
      setSourceFilter('all');
    }
  }, [sourceFilter, sourceOptions]);

  const visibleItems = useMemo(() => {
    return filterAndSortOrganizerItems(
        organizerItems,
      deferredQuery,
      statusFilter,
      sortBy,
      sourceFilter === 'all' ? null : sourceFilter
    );
  }, [deferredQuery, organizerItems, sortBy, sourceFilter, statusFilter]);

  return {
    query,
    setQuery,
    statusFilter,
    setStatusFilter,
    sourceFilter,
    setSourceFilter,
    sourceOptions,
    sortBy,
    setSortBy,
    visibleItems
  };
}
