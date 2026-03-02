import type { MangaBookWithCover } from '@shared/types';
import type { OrganizerCategory, OrganizerItem, OrganizerSortKey, OrganizerStatusFilter } from './types';
import { getMangaDisplayPath, getMangaPathCategory, normalizeDirectoryName } from '@renderer/pages/Library/utils';

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+$/, '');
}

function splitPath(value: string): { segments: string[]; hasLeadingSlash: boolean } {
  const normalized = normalizePath(value);
  return {
    segments: normalized.split('/').filter(Boolean),
    hasLeadingSlash: normalized.startsWith('/')
  };
}

function joinPath(segments: string[], hasLeadingSlash: boolean): string {
  if (segments.length === 0) {
    return hasLeadingSlash ? '/' : '';
  }
  return `${hasLeadingSlash ? '/' : ''}${segments.join('/')}`;
}

function getCategoryLocation(
  manga: MangaBookWithCover,
  pathCategory: 'artists' | 'series'
): { label: string; path: string } | null {
  const { segments, hasLeadingSlash } = splitPath(manga.folderPath);
  const marker = pathCategory === 'artists' ? ['artists', 'artist'] : ['series'];
  const markerIndex = segments.findIndex((segment) => marker.includes(normalizeDirectoryName(segment)));

  if (markerIndex >= 0 && markerIndex + 1 < segments.length) {
    const label = segments[markerIndex + 1] ?? '未命名目录';
    return {
      label,
      path: joinPath(segments.slice(0, markerIndex + 2), hasLeadingSlash)
    };
  }

  if (segments.length >= 2) {
    const label = segments[segments.length - 2] ?? '未命名目录';
    return {
      label,
      path: joinPath(segments.slice(0, -1), hasLeadingSlash)
    };
  }

  return null;
}

function getSegmentAfterMarker(segments: string[], marker: string[]): string | null {
  const markerIndex = segments.findIndex((segment) => marker.includes(normalizeDirectoryName(segment)));
  if (markerIndex >= 0 && markerIndex + 1 < segments.length) {
    return segments[markerIndex + 1] ?? null;
  }
  return null;
}

function getOwnerBadge(manga: MangaBookWithCover): string | null {
  const sourceKind = getMangaPathCategory(manga.folderPath, manga.sourceFolderPath);
  if (sourceKind === 'other') {
    return null;
  }

  const markers = sourceKind === 'artists' ? ['artists', 'artist'] : ['series'];
  const targetSegments = splitPath(manga.folderPath).segments;
  const sourceSegments = splitPath(manga.sourceFolderPath).segments;

  const fromMarker = getSegmentAfterMarker(targetSegments, markers);
  const ownerName =
    fromMarker ??
    (markers.includes(normalizeDirectoryName(sourceSegments[sourceSegments.length - 1] ?? ''))
      ? targetSegments[sourceSegments.length]
      : null);

  if (!ownerName) {
    return null;
  }

  return `作者 ${ownerName}`;
}

export function buildOrganizerCategories(mangas: MangaBookWithCover[]): OrganizerCategory[] {
  const bucket = new Map<string, OrganizerCategory>();

  for (const manga of mangas) {
    const sourceKind = getMangaPathCategory(manga.folderPath, manga.sourceFolderPath);
    if (sourceKind === 'other') {
      continue;
    }

    const location = getCategoryLocation(manga, sourceKind);
    if (!location) {
      continue;
    }

    const key = `artists:${location.path}`;
    const existing = bucket.get(key);

    if (existing) {
      existing.count += 1;
      if (new Date(manga.addedAt).getTime() > new Date(existing.latestAddedAt).getTime()) {
        existing.latestAddedAt = manga.addedAt;
      }
      continue;
    }

    bucket.set(key, {
      key,
      label: location.label,
      path: location.path,
      count: 1,
      kind: 'artists',
      latestAddedAt: manga.addedAt
    });
  }

  return [...bucket.values()].sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    return a.label.localeCompare(b.label, 'zh-Hans-CN');
  });
}

export function buildOrganizerItems(mangas: MangaBookWithCover[]): OrganizerItem[] {
  return mangas.map((manga) => ({
    ...manga,
    displayPath: getMangaDisplayPath(manga.folderPath, manga.sourceFolderPath),
    ownerBadge: getOwnerBadge(manga),
    organizeStatus: getMangaPathCategory(manga.folderPath, manga.sourceFolderPath) === 'other' ? 'unorganized' : 'organized'
  }));
}

export function filterAndSortOrganizerItems(
  mangas: OrganizerItem[],
  query: string,
  statusFilter: OrganizerStatusFilter,
  sortBy: OrganizerSortKey
): OrganizerItem[] {
  const keyword = query.trim().toLowerCase();

  const filtered = mangas.filter((manga) => {
    if (statusFilter === 'organized' && manga.organizeStatus !== 'organized') {
      return false;
    }

    if (statusFilter === 'unorganized' && manga.organizeStatus !== 'unorganized') {
      return false;
    }

    const matchesQuery =
      keyword.length === 0 ||
      manga.title.toLowerCase().includes(keyword) ||
      manga.displayPath.toLowerCase().includes(keyword);

    if (!matchesQuery) {
      return false;
    }

    return true;
  });

  return filtered.sort((a, b) => {
    if (sortBy === 'title') {
      return a.title.localeCompare(b.title, 'zh-Hans-CN');
    }

    if (sortBy === 'pages') {
      return b.totalPages - a.totalPages;
    }

    return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
  });
}
