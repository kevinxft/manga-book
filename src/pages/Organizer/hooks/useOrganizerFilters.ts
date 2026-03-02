import { useMemo, useState } from 'react';
import type { OrganizerItem, OrganizerSortKey, OrganizerStatusFilter } from '../types';
import { filterAndSortOrganizerItems } from '../utils';

interface UseOrganizerFiltersArgs {
  organizerItems: OrganizerItem[];
}

export function useOrganizerFilters({ organizerItems }: UseOrganizerFiltersArgs) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrganizerStatusFilter>('unorganized');
  const [sortBy, setSortBy] = useState<OrganizerSortKey>('addedAt');

  const visibleItems = useMemo(() => {
    return filterAndSortOrganizerItems(organizerItems, query, statusFilter, sortBy);
  }, [organizerItems, query, sortBy, statusFilter]);

  return {
    query,
    setQuery,
    statusFilter,
    setStatusFilter,
    sortBy,
    setSortBy,
    visibleItems
  };
}
