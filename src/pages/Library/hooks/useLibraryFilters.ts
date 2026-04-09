import { useDeferredValue, useEffect, useMemo, useState } from 'react';
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
  const deferredSearch = useDeferredValue(search);

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

    const keyword = deferredSearch.trim().toLocaleLowerCase();
    const bySearch =
      keyword.length === 0
        ? byArtist
        : byArtist.filter((manga) => {
            if (manga.title.toLocaleLowerCase().includes(keyword)) {
              return true;
            }
            if (manga.folderPath.toLocaleLowerCase().includes(keyword)) {
              return true;
            }
            return manga.tags.some((tag) => tag.name.toLocaleLowerCase().includes(keyword));
          });

    const byTags =
      selectedTags.length === 0
        ? bySearch
        : bySearch.filter((manga) => {
            const mangaTagIds = new Set((manga.tags ?? []).map((tag) => tag.id));
            return selectedTags.every((tagId) => mangaTagIds.has(tagId));
          });

    return [...byTags].sort((first, second) => {
      if (sortBy === 'lastReadAtDesc') {
        return (second.lastReadAt ?? second.addedAt).localeCompare(first.lastReadAt ?? first.addedAt);
      }
      if (sortBy === 'addedAtAsc') {
        return first.addedAt.localeCompare(second.addedAt);
      }
      if (sortBy === 'titleAsc') {
        return first.title.localeCompare(second.title, 'zh-Hans-CN');
      }
      if (sortBy === 'titleDesc') {
        return second.title.localeCompare(first.title, 'zh-Hans-CN');
      }
      return second.addedAt.localeCompare(first.addedAt);
    });
  }, [activeMenu, deferredSearch, mangas, selectedTags, sortBy]);

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
