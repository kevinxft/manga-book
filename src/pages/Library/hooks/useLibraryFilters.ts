import { useEffect, useMemo, useState } from 'react';
import type { LibraryFolder, MangaBookWithCover } from '@shared/types';
import type { LibraryStatusFilter, MangaCategoryFilter, SortKey } from '../types';
import { getMangaPathCategory } from '../utils';

interface UseLibraryFiltersInput {
  mangas: MangaBookWithCover[];
  sources: LibraryFolder[];
  selectedTags: string[];
}

export function useLibraryFilters({ mangas, sources, selectedTags }: UseLibraryFiltersInput) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('addedAt');
  const [activeMenu, setActiveMenu] = useState('all');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<MangaCategoryFilter>('all');
  const [statusFilter, setStatusFilter] = useState<LibraryStatusFilter>('all');

  useEffect(() => {
    if (activeMenu === 'all') {
      return;
    }
    const sourceId = activeMenu.startsWith('source:') ? activeMenu.slice('source:'.length) : '';
    if (!sourceId || !sources.some((source) => source.id === sourceId)) {
      setActiveMenu('all');
    }
  }, [activeMenu, sources]);

  const visibleMangas = useMemo(() => {
    const selectedSourcePath =
      activeMenu.startsWith('source:') ? sources.find((source) => source.id === activeMenu.slice('source:'.length))?.path : null;

    const bySource = selectedSourcePath ? mangas.filter((manga) => manga.sourceFolderPath === selectedSourcePath) : mangas;
    const byStatus = bySource.filter((manga) => {
      if (statusFilter === 'all') {
        return true;
      }
      const category = getMangaPathCategory(manga.folderPath, manga.sourceFolderPath);
      const organized = category !== 'other';
      return statusFilter === 'organized' ? organized : !organized;
    });
    const byTags =
      selectedTags.length === 0
        ? byStatus
        : byStatus.filter((manga) => {
            const mangaTagIds = new Set((manga.tags ?? []).map((tag) => tag.id));
            return selectedTags.every((tagId) => mangaTagIds.has(tagId));
          });

    if (categoryFilter === 'all') {
      return byTags;
    }
    return byTags.filter((manga) => getMangaPathCategory(manga.folderPath, manga.sourceFolderPath) === categoryFilter);
  }, [activeMenu, categoryFilter, mangas, selectedTags, sources, statusFilter]);

  const sourceMangaCountByPath = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const manga of mangas) {
      counts[manga.sourceFolderPath] = (counts[manga.sourceFolderPath] ?? 0) + 1;
    }
    return counts;
  }, [mangas]);

  return {
    search,
    sortBy,
    activeMenu,
    sidebarCollapsed,
    categoryFilter,
    statusFilter,
    visibleMangas,
    sourceMangaCountByPath,
    setSearch,
    setSortBy,
    setActiveMenu,
    setSidebarCollapsed,
    setCategoryFilter,
    setStatusFilter
  };
}
