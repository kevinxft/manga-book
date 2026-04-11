import { useCallback, useEffect, useRef, useState } from 'react';
import type { MangaBookWithCover } from '@shared/types';
import { ipcInvoke } from '@renderer/ipc/client';
import type { ReaderMode } from '../types';

interface UseReaderPagesInput {
  manga: MangaBookWithCover;
  readerMode: ReaderMode;
  hasIpcBridge: boolean;
  rememberReadingProgress: boolean;
}

export function useReaderPages({ manga, readerMode, hasIpcBridge, rememberReadingProgress }: UseReaderPagesInput) {
  const [pagePaths, setPagePaths] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);
  const loadRequestIdRef = useRef(0);

  useEffect(() => {
    pageRefs.current = [];
  }, [manga.id]);

  const reloadPages = useCallback(
    async (options?: { preferredPagePath?: string; fallbackPageIndex?: number; silent?: boolean }) => {
      const requestId = loadRequestIdRef.current + 1;
      loadRequestIdRef.current = requestId;

      if (!hasIpcBridge) {
        setLoading(false);
        setError('当前运行在普通浏览器环境，无法读取漫画页面。请使用 bun run dev 启动 Electron。');
        return [] as string[];
      }

      if (!options?.silent) {
        setLoading(true);
      }
      setError(null);

      try {
        const pages = await ipcInvoke('reader.listPages', { mangaId: manga.id });
        if (requestId !== loadRequestIdRef.current) {
          return pages;
        }

        setPagePaths(pages);

        const initialIndex = rememberReadingProgress
          ? Math.max(0, Math.min(manga.lastPageIndex, Math.max(pages.length - 1, 0)))
          : 0;
        const fallbackIndex =
          typeof options?.fallbackPageIndex === 'number'
            ? Math.max(0, Math.min(options.fallbackPageIndex, Math.max(pages.length - 1, 0)))
            : initialIndex;
        const preferredIndex =
          options?.preferredPagePath && pages.length > 0 ? pages.indexOf(options.preferredPagePath) : -1;

        setCurrentPageIndex(preferredIndex >= 0 ? preferredIndex : fallbackIndex);
        return pages;
      } catch (loadError) {
        if (requestId !== loadRequestIdRef.current) {
          return [] as string[];
        }

        setError(loadError instanceof Error ? loadError.message : '加载漫画页面失败');
        setPagePaths([]);
        return [] as string[];
      } finally {
        if (requestId === loadRequestIdRef.current && !options?.silent) {
          setLoading(false);
        }
      }
    },
    [hasIpcBridge, manga.id, manga.lastPageIndex, rememberReadingProgress]
  );

  useEffect(() => {
    if (!hasIpcBridge) {
      setLoading(false);
      setError('当前运行在普通浏览器环境，无法读取漫画页面。请使用 bun run dev 启动 Electron。');
      return;
    }

    void reloadPages();
    return () => {
      loadRequestIdRef.current += 1;
    };
  }, [hasIpcBridge, reloadPages]);

  useEffect(() => {
    if (readerMode !== 'scroll' || pagePaths.length === 0) return;
    const targetIndex = rememberReadingProgress ? Math.max(0, Math.min(manga.lastPageIndex, pagePaths.length - 1)) : 0;
    const targetNode = pageRefs.current[targetIndex];
    if (!targetNode) return;
    requestAnimationFrame(() => {
      targetNode.scrollIntoView({ block: 'start' });
    });
  }, [manga.lastPageIndex, pagePaths, readerMode, rememberReadingProgress]);

  useEffect(() => {
    if (readerMode !== 'scroll') {
      return;
    }

    const root = scrollContainerRef.current;
    if (!root || pagePaths.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let maxRatio = 0;
        let nextIndex: number | null = null;
        for (const entry of entries) {
          if (!entry.isIntersecting || entry.intersectionRatio < maxRatio) {
            continue;
          }
          const index = Number((entry.target as HTMLElement).dataset.pageIndex);
          if (Number.isNaN(index)) {
            continue;
          }
          maxRatio = entry.intersectionRatio;
          nextIndex = index;
        }
        if (nextIndex !== null) {
          setCurrentPageIndex(nextIndex);
        }
      },
      { root, threshold: [0.35, 0.55, 0.8] }
    );

    pageRefs.current.forEach((node) => {
      if (node) observer.observe(node);
    });

    return () => observer.disconnect();
  }, [pagePaths, readerMode]);

  return {
    pagePaths,
    loading,
    error,
    currentPageIndex,
    setCurrentPageIndex,
    scrollContainerRef,
    pageRefs,
    reloadPages
  };
}
