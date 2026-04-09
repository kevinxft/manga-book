import type { DirectoryAlias, MangaBookWithCover } from '@shared/types';
import type { OrganizerCategory, OrganizerItem, OrganizerSortKey, OrganizerStatusFilter } from './types';
import { getMangaDisplayPath, getMangaPathCategory } from '@renderer/pages/Library/utils';

export interface AuthorAliasLookupContext {
  canonicalByAnyName: Map<string, string>;
  aliasesByCanonicalName: Map<string, string[]>;
}

export interface MangaAuthorInfo {
  directoryName: string;
  directoryPath: string;
  canonicalName: string | null;
  aliases: string[];
  tooltipText: string;
  ownerBadge: string;
}

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

function normalizeDirectoryPaths(directoryPaths: string[]): string[] {
  return Array.from(
    new Set(
      directoryPaths
        .map((value) => normalizePath(value))
        .filter((value) => value.length > 0)
    )
  ).sort((a, b) => b.length - a.length);
}

function getExplicitAuthorDirectory(folderPath: string, directoryPaths: string[]): string | null {
  const normalizedFolderPath = normalizePath(folderPath);
  const normalizedDirectories = normalizeDirectoryPaths(directoryPaths);

  for (const directoryPath of normalizedDirectories) {
    if (normalizedFolderPath === directoryPath || normalizedFolderPath.startsWith(`${directoryPath}/`)) {
      return directoryPath;
    }
  }

  return null;
}

function getCategoryLocation(
  manga: MangaBookWithCover,
  targetSourcePaths: string[],
  directoryPaths: string[] = []
): { label: string; path: string } | null {
  const explicitDirectory = getExplicitAuthorDirectory(manga.folderPath, directoryPaths);
  if (explicitDirectory) {
    return {
      label: getPathLabel(explicitDirectory),
      path: explicitDirectory
    };
  }

  const source = normalizePath(manga.sourceFolderPath);
  const target = normalizePath(manga.folderPath);
  if (!targetSourcePaths.map((item) => normalizePath(item)).includes(source)) {
    return null;
  }
  if (!target.startsWith(`${source}/`)) {
    return null;
  }

  const { hasLeadingSlash } = splitPath(target);
  const relativeSegments = target.slice(source.length + 1).split('/').filter(Boolean);
  const authorName = relativeSegments[0];
  if (!authorName) {
    return null;
  }

  const sourceSegments = splitPath(source).segments;
  return {
    label: authorName,
    path: joinPath([...sourceSegments, authorName], hasLeadingSlash)
  };
}

function toLookupKey(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function createAuthorAliasLookup(aliases: DirectoryAlias[]): AuthorAliasLookupContext {
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

function resolveAuthorDirectory(
  manga: MangaBookWithCover,
  targetSourcePaths: string[],
  directoryPaths: string[] = []
): { directoryName: string; directoryPath: string } | null {
  const explicitDirectory = getExplicitAuthorDirectory(manga.folderPath, directoryPaths);
  if (explicitDirectory) {
    return {
      directoryName: getPathLabel(explicitDirectory),
      directoryPath: explicitDirectory
    };
  }

  const sourceKind = getMangaPathCategory(manga.folderPath, manga.sourceFolderPath, targetSourcePaths);
  if (sourceKind === 'other') {
    return null;
  }

  const source = normalizePath(manga.sourceFolderPath);
  const target = normalizePath(manga.folderPath);
  if (!target.startsWith(`${source}/`)) {
    return null;
  }

  const { hasLeadingSlash } = splitPath(target);
  const relativeSegments = target.slice(source.length + 1).split('/').filter(Boolean);
  const directoryName = relativeSegments[0];
  if (!directoryName) {
    return null;
  }

  const sourceSegments = splitPath(source).segments;
  return {
    directoryName,
    directoryPath: joinPath([...sourceSegments, directoryName], hasLeadingSlash)
  };
}

function dedupeNames(values: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }

    const key = toLookupKey(trimmed);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(trimmed);
  }

  return deduped;
}

function buildOwnerBadge(directoryName: string, canonicalName: string | null, aliases: string[]): string {
  if (canonicalName) {
    const detailNames = dedupeNames([directoryName, ...aliases]);
    return detailNames.length > 0 ? `${canonicalName} (${detailNames.join(' / ')})` : canonicalName;
  }

  return aliases.length > 0 ? `${directoryName} (${aliases.join(' / ')})` : directoryName;
}

function buildTooltipText(directoryName: string, canonicalName: string | null, aliases: string[]): string {
  const lines: string[] = [];

  if (canonicalName) {
    lines.push(`规范名：${canonicalName}`);
  }
  lines.push(`目录名：${directoryName}`);
  if (aliases.length > 0) {
    lines.push(`别名：${aliases.join(' / ')}`);
  }

  return lines.join('\n');
}

export function resolveMangaAuthorInfo(
  manga: MangaBookWithCover,
  aliasLookup: AuthorAliasLookupContext | null,
  targetSourcePaths: string[],
  directoryPaths: string[] = []
): MangaAuthorInfo | null {
  const authorDirectory = resolveAuthorDirectory(manga, targetSourcePaths, directoryPaths);
  if (!authorDirectory) {
    return null;
  }

  const resolvedCanonicalName = aliasLookup?.canonicalByAnyName.get(toLookupKey(authorDirectory.directoryName)) ?? null;
  const canonicalName =
    resolvedCanonicalName && toLookupKey(resolvedCanonicalName) !== toLookupKey(authorDirectory.directoryName)
      ? resolvedCanonicalName
      : null;
  const lookupKey = toLookupKey(canonicalName ?? authorDirectory.directoryName);
  const aliases = dedupeNames(
    (aliasLookup?.aliasesByCanonicalName.get(lookupKey) ?? []).filter((alias) => {
      const aliasKey = toLookupKey(alias);
      return aliasKey !== toLookupKey(authorDirectory.directoryName) && aliasKey !== toLookupKey(canonicalName ?? '');
    })
  );

  return {
    directoryName: authorDirectory.directoryName,
    directoryPath: authorDirectory.directoryPath,
    canonicalName,
    aliases,
    tooltipText: buildTooltipText(authorDirectory.directoryName, canonicalName, aliases),
    ownerBadge: buildOwnerBadge(authorDirectory.directoryName, canonicalName, aliases)
  };
}

export function buildOrganizerCategories(
  mangas: MangaBookWithCover[],
  directoryPaths: string[] = [],
  targetSourcePaths: string[] = []
): OrganizerCategory[] {
  const bucket = new Map<string, OrganizerCategory>();
  const normalizedDirectoryPaths = normalizeDirectoryPaths(directoryPaths);

  for (const manga of mangas) {
    const explicitDirectory = getExplicitAuthorDirectory(manga.folderPath, normalizedDirectoryPaths);
    const sourceKind = explicitDirectory ? 'artists' : getMangaPathCategory(manga.folderPath, manga.sourceFolderPath, targetSourcePaths);
    if (sourceKind === 'other' && !explicitDirectory) {
      continue;
    }

    const location = getCategoryLocation(manga, targetSourcePaths, normalizedDirectoryPaths);
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

  for (const normalizedPath of normalizedDirectoryPaths) {
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

export function buildOrganizerItems(
  mangas: MangaBookWithCover[],
  aliases: DirectoryAlias[] = [],
  targetSourcePaths: string[] = [],
  directoryPaths: string[] = []
): OrganizerItem[] {
  const aliasLookup = aliases.length > 0 ? createAuthorAliasLookup(aliases) : null;
  const normalizedDirectoryPaths = normalizeDirectoryPaths(directoryPaths);

  return mangas.map((manga) => ({
    ...manga,
    displayPath: getMangaDisplayPath(manga.folderPath, manga.sourceFolderPath),
    ownerBadge: resolveMangaAuthorInfo(manga, aliasLookup, targetSourcePaths, normalizedDirectoryPaths)?.ownerBadge ?? null,
    organizeStatus:
      getExplicitAuthorDirectory(manga.folderPath, normalizedDirectoryPaths) ||
      getMangaPathCategory(manga.folderPath, manga.sourceFolderPath, targetSourcePaths) !== 'other'
        ? 'organized'
        : 'unorganized'
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
