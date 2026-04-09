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

function normalizeSourcePaths(sourcePaths: string[]): string[] {
  return sourcePaths.map((value) => normalizePath(value));
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

export function getMangaPathCategory(folderPath: string, sourceFolderPath: string, targetSourcePaths: string[] = []): MangaPathCategory {
  const source = normalizePath(sourceFolderPath);
  const target = normalizePath(folderPath);
  const normalizedTargetSources = normalizeSourcePaths(targetSourcePaths);

  if (!target.startsWith(`${source}/`)) {
    return 'other';
  }

  const relPath = target.slice(source.length + 1);
  const relativeSegments = relPath.split('/').filter(Boolean);

  if (normalizedTargetSources.includes(source) && relativeSegments.length >= 2) {
    return 'artists';
  }

  return 'other';
}

export function getArtistNameFromMangaPath(
  folderPath: string,
  sourceFolderPath: string,
  targetSourcePaths: string[] = []
): string | null {
  const source = normalizePath(sourceFolderPath);
  const target = normalizePath(folderPath);
  const normalizedTargetSources = normalizeSourcePaths(targetSourcePaths);

  if (!normalizedTargetSources.includes(source) || !target.startsWith(`${source}/`)) {
    return null;
  }

  const relativeSegments = target.slice(source.length + 1).split('/').filter(Boolean);
  if (relativeSegments.length < 2) {
    return null;
  }

  return relativeSegments[0] ?? null;
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

type SourceLike = {
  path: string;
  isTarget: boolean;
};

export function resolveTargetSourcePaths(
  sources: SourceLike[],
  authorDirectoryPaths: string[] = []
): string[] {
  const explicitTargets = Array.from(
    new Set(
      sources
        .filter((source) => source.isTarget)
        .map((source) => normalizePath(source.path))
        .filter((value) => value.length > 0)
    )
  );
  if (explicitTargets.length > 0) {
    return explicitTargets;
  }

  const inferredParents = Array.from(
    new Set(
      authorDirectoryPaths
        .map((directoryPath) => getParentDirectoryPath(directoryPath))
        .map((directoryPath) => normalizePath(directoryPath))
        .filter((value) => value.length > 0)
    )
  );

  return inferredParents.length === 1 ? inferredParents : [];
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
