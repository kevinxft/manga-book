import type { MangaPathCategory } from './types';

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+$/, '');
}

const CONFLICT_TITLE_SUFFIX_PATTERN = /^(.*?)(?:\s*[（(](\d+)[)）])$/;

export function toCoverSrc(filePath: string): string {
  return `manga-cover://local-image?path=${encodeURIComponent(filePath)}`;
}

export function getMangaDisplayPath(folderPath: string, sourceFolderPath: string): string {
  const source = normalizePath(sourceFolderPath);
  const target = normalizePath(folderPath);
  const sourceName = source.split('/').filter(Boolean).pop() ?? source;

  if (target === source) {
    return sourceName;
  }

  if (target.startsWith(`${source}/`)) {
    const relative = target.slice(source.length + 1);
    return `${sourceName}/${relative}`;
  }

  return target;
}

export function normalizeDirectoryName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function hexToRgb(color: string): { r: number; g: number; b: number } | null {
  const normalized = color.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return null;
  }

  const value = Number.parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

export function toRgba(color: string, alpha: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) {
    return color;
  }
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

export function getTagTextColor(color: string): string {
  const rgb = hexToRgb(color);
  if (!rgb) {
    return '#f8fafc';
  }
  const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return brightness > 168 ? '#162234' : '#f8fafc';
}

export function getMangaPathCategory(folderPath: string, sourceFolderPath: string): MangaPathCategory {
  const source = normalizePath(sourceFolderPath);
  const target = normalizePath(folderPath);
  const sourceBase = normalizeDirectoryName(source.split('/').filter(Boolean).pop() ?? '');

  if (sourceBase === 'artists' || sourceBase === 'artist') {
    return 'artists';
  }
  if (sourceBase === 'series') {
    return 'series';
  }

  if (!target.startsWith(`${source}/`)) {
    return 'other';
  }

  const relPath = target.slice(source.length + 1);
  const firstSegment = relPath.split('/').filter(Boolean)[0] ?? '';
  const firstKey = normalizeDirectoryName(firstSegment);

  if (firstKey === 'artists' || firstKey === 'artist') {
    return 'artists';
  }
  if (firstKey === 'series') {
    return 'series';
  }
  return 'other';
}

export function getArtistNameFromMangaPath(folderPath: string): string | null {
  const segments = folderPath.replace(/\\/g, '/').split('/').filter(Boolean);
  if (segments.length < 3) {
    return null;
  }

  const artistsIndex = segments.findIndex((segment) => {
    const key = normalizeDirectoryName(segment);
    return key === 'artists' || key === 'artist';
  });

  if (artistsIndex < 0) {
    return null;
  }

  const artistIndex = artistsIndex + 1;
  const mangaIndex = artistsIndex + 2;
  if (artistIndex >= segments.length || mangaIndex >= segments.length) {
    return null;
  }

  return segments[artistIndex] ?? null;
}

export function getParentDirectoryPath(folderPath: string): string {
  const normalized = normalizePath(folderPath);
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length <= 1) {
    return normalized;
  }

  const parentSegments = segments.slice(0, -1);
  return `${normalized.startsWith('/') ? '/' : ''}${parentSegments.join('/')}`;
}

export function getConflictBaseTitle(title: string): { baseTitle: string; hasConflictSuffix: boolean } {
  const trimmed = title.trim();
  const match = trimmed.match(CONFLICT_TITLE_SUFFIX_PATTERN);
  if (!match) {
    return {
      baseTitle: trimmed,
      hasConflictSuffix: false
    };
  }

  return {
    baseTitle: (match[1] ?? trimmed).trim(),
    hasConflictSuffix: true
  };
}
