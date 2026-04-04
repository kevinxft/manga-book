import type { DirectoryAlias, MangaBookWithCover } from '@shared/types';
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

function getPathLabel(pathValue: string): string {
  const { segments } = splitPath(pathValue);
  return segments[segments.length - 1] ?? '未命名目录';
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

function toLookupKey(value: string): string {
  return value.trim().toLocaleLowerCase();
}

interface AliasLookupContext {
  canonicalByAnyName: Map<string, string>;
  aliasesByCanonicalName: Map<string, string[]>;
}

function createAliasLookup(aliases: DirectoryAlias[]): AliasLookupContext {
  const canonicalByAnyName = new Map<string, string>();
  const aliasesByCanonicalName = new Map<string, string[]>();

  for (const record of aliases) {
    const canonicalName = record.canonicalName.trim();
    const aliasName = record.alias.trim();
    if (!canonicalName || !aliasName) {
      continue;
    }

    const canonicalKey = toLookupKey(canonicalName);
    const aliasKey = toLookupKey(aliasName);
    canonicalByAnyName.set(canonicalKey, canonicalName);
    canonicalByAnyName.set(aliasKey, canonicalName);

    const currentAliases = aliasesByCanonicalName.get(canonicalKey) ?? [];
    if (!currentAliases.some((item) => toLookupKey(item) === aliasKey)) {
      currentAliases.push(aliasName);
      aliasesByCanonicalName.set(canonicalKey, currentAliases);
    }
  }

  return {
    canonicalByAnyName,
    aliasesByCanonicalName
  };
}

function getOwnerBadge(manga: MangaBookWithCover, aliasLookup: AliasLookupContext | null): string | null {
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

  const canonicalName = aliasLookup?.canonicalByAnyName.get(toLookupKey(ownerName)) ?? ownerName;
  const canonicalKey = toLookupKey(canonicalName);
  const aliases = (aliasLookup?.aliasesByCanonicalName.get(canonicalKey) ?? []).filter(
    (alias) => toLookupKey(alias) !== canonicalKey
  );

  if (aliases.length === 0) {
    return canonicalName;
  }

  return `${canonicalName} (${aliases.join(' / ')})`;
}

export function buildOrganizerCategories(mangas: MangaBookWithCover[], directoryPaths: string[] = []): OrganizerCategory[] {
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
      aliases: [],
      path: location.path,
      count: 1,
      kind: 'artists',
      latestAddedAt: manga.addedAt,
      lastMovedAt: null
    });
  }

  for (const rawPath of directoryPaths) {
    const normalizedPath = normalizePath(rawPath);
    if (!normalizedPath) {
      continue;
    }
    const key = `artists:${normalizedPath}`;
    if (bucket.has(key)) {
      continue;
    }

    bucket.set(key, {
      key,
      label: getPathLabel(normalizedPath),
      aliases: [],
      path: normalizedPath,
      count: 0,
      kind: 'artists',
      latestAddedAt: '1970-01-01T00:00:00.000Z',
      lastMovedAt: null
    });
  }

  return [...bucket.values()].sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    return a.label.localeCompare(b.label, 'zh-Hans-CN');
  });
}

export function buildOrganizerItems(mangas: MangaBookWithCover[], aliases: DirectoryAlias[] = []): OrganizerItem[] {
  const aliasLookup = aliases.length > 0 ? createAliasLookup(aliases) : null;

  return mangas.map((manga) => ({
    ...manga,
    displayPath: getMangaDisplayPath(manga.folderPath, manga.sourceFolderPath),
    ownerBadge: getOwnerBadge(manga, aliasLookup),
    organizeStatus: getMangaPathCategory(manga.folderPath, manga.sourceFolderPath) === 'other' ? 'unorganized' : 'organized'
  }));
}

export function filterAndSortOrganizerItems(
  mangas: OrganizerItem[],
  query: string,
  statusFilter: OrganizerStatusFilter,
  sortBy: OrganizerSortKey,
  sourceFolderPath?: string | null
): OrganizerItem[] {
  const keyword = query.trim().toLowerCase();
  const normalizedSourceFilter = sourceFolderPath?.trim();

  const filtered = mangas.filter((manga) => {
    if (statusFilter === 'organized' && manga.organizeStatus !== 'organized') {
      return false;
    }

    if (statusFilter === 'unorganized' && manga.organizeStatus !== 'unorganized') {
      return false;
    }

    if (normalizedSourceFilter && manga.sourceFolderPath !== normalizedSourceFilter) {
      return false;
    }

    const matchesQuery =
      keyword.length === 0 ||
      manga.title.toLowerCase().includes(keyword) ||
      manga.displayPath.toLowerCase().includes(keyword) ||
      (manga.ownerBadge?.toLowerCase().includes(keyword) ?? false);

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
