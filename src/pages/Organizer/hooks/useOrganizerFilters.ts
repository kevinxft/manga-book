import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import type { OrganizerItem, OrganizerSortKey, OrganizerSourceFilterOption } from '../types';
import { filterAndSortOrganizerItems } from '../utils';

interface UseOrganizerFiltersArgs {
  organizerItems: OrganizerItem[];
}

export function useOrganizerFilters({ organizerItems }: UseOrganizerFiltersArgs) {
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<OrganizerSortKey>('addedAt');
  const [sourceFilter, setSourceFilter] = useState('all');
  const deferredQuery = useDeferredValue(query);

  const sourceOptions = useMemo<OrganizerSourceFilterOption[]>(() => {
    const labelsByPath = new Map<string, string>();
    const countsByLabel = new Map<string, number>();
    let authorsRootPath: string | null = null;

    for (const item of organizerItems) {
      if (item.organizeStatus === 'organized') {
        if (!authorsRootPath) {
          authorsRootPath = `${item.sourceFolderPath.trim().replace(/[\\/]+$/, '')}/Authors`;
        }
        continue;
      }

      const normalized = item.locationFilterPath.trim();
      if (!normalized || labelsByPath.has(normalized)) {
        continue;
      }

      const label = item.locationFilterLabel.trim() || normalized;
      labelsByPath.set(normalized, label);
      countsByLabel.set(label, (countsByLabel.get(label) ?? 0) + 1);
    }

    const unsortedOptions = [...labelsByPath.entries()]
      .map(([path, label]) => {
        const segments = path.replace(/\\/g, '/').split('/').filter(Boolean);
        const parent = segments[segments.length - 2]?.trim();
        const duplicateLabel = (countsByLabel.get(label) ?? 0) > 1;

        return {
          path,
          label: duplicateLabel && parent ? `${label} · ${parent}` : label || path
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label, 'zh-Hans-CN'));

    return authorsRootPath
      ? [
          {
            path: authorsRootPath,
            label: '作者目录'
          },
          ...unsortedOptions
        ]
      : unsortedOptions;
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
      sortBy,
      sourceFilter === 'all' ? null : sourceFilter
    );
  }, [deferredQuery, organizerItems, sortBy, sourceFilter]);

  return {
    query,
    setQuery,
    sourceFilter,
    setSourceFilter,
    sourceOptions,
    sortBy,
    setSortBy,
    visibleItems
  };
}
