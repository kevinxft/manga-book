import type { MangaBook, MangaBookWithCover } from '@shared/types';

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+$/, '');
}

function rewriteCoverPath(coverPath: string | null, fromFolderPath: string, toFolderPath: string): string | null {
  if (!coverPath) {
    return null;
  }

  const normalizedFrom = normalizePath(fromFolderPath);
  const normalizedTo = normalizePath(toFolderPath);
  const normalizedCover = normalizePath(coverPath);

  if (normalizedFrom === normalizedTo) {
    return normalizedCover;
  }

  if (normalizedCover === normalizedFrom) {
    return normalizedTo;
  }

  if (normalizedCover.startsWith(`${normalizedFrom}/`)) {
    return `${normalizedTo}${normalizedCover.slice(normalizedFrom.length)}`;
  }

  return null;
}

export function mergeMangaWithBase(current: MangaBookWithCover, nextBase: MangaBook): MangaBookWithCover {
  const nextCoverPath = rewriteCoverPath(current.coverPath, current.folderPath, nextBase.folderPath);

  return {
    ...current,
    ...nextBase,
    coverPath: nextCoverPath,
    tags: current.tags
  };
}
