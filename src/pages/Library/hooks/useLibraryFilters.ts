import { useEffect, useMemo, useState } from 'react';
import type { MangaBookWithCover } from '@shared/types';
import type { SortKey } from '../types';
import type { OrganizerCategory } from '@renderer/pages/Organizer/types';

interface UseLibraryFiltersInput {
  mangas: MangaBookWithCover[];
  artistDirectories: OrganizerCategory[];
  selectedTags: string[];
}

export function useLibraryFilters({ mangas, artistDirectories, selectedTags }: UseLibraryFiltersInput) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('addedAtDesc');
  const [activeMenu, setActiveMenu] = useState<string>('all');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (activeMenu === 'all') {
      return;
    }

    const activeArtistPath = activeMenu.startsWith('artist:') ? activeMenu.slice('artist:'.length) : '';
    if (!activeArtistPath || !artistDirectories.some((item) => item.path === activeArtistPath)) {
      setActiveMenu('all');
    }
  }, [activeMenu, artistDirectories]);

  const visibleMangas = useMemo(() => {
    const activeArtistPath = activeMenu.startsWith('artist:') ? activeMenu.slice('artist:'.length) : null;
    const byArtist =
      activeArtistPath && activeArtistPath.length > 0
        ? mangas.filter((manga) => manga.folderPath.startsWith(`${activeArtistPath}/`) || manga.folderPath.startsWith(`${activeArtistPath}\\`))
        : mangas;

    const byTags =
      selectedTags.length === 0
        ? byArtist
        : byArtist.filter((manga) => {
            const mangaTagIds = new Set((manga.tags ?? []).map((tag) => tag.id));
            return selectedTags.every((tagId) => mangaTagIds.has(tagId));
          });

    return byTags;
  }, [activeMenu, mangas, selectedTags]);

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
    visibleMangas,
    sourceMangaCountByPath,
    setSearch,
    setSortBy,
    setActiveMenu,
    setSidebarCollapsed
  };
}
