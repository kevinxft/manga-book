import { useEffect, useRef, useState } from 'react';
import type { MangaBookWithCover } from '@shared/types';
import { ipcInvoke } from '@renderer/ipc/client';
import type { ReaderMode } from '../types';

interface UseReaderPagesInput {
  manga: MangaBookWithCover;
  readerMode: ReaderMode;
  hasIpcBridge: boolean;
}

export function useReaderPages({ manga, readerMode, hasIpcBridge }: UseReaderPagesInput) {
  const [pagePaths, setPagePaths] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    pageRefs.current = [];
  }, [manga.id]);

  useEffect(() => {
    if (!hasIpcBridge) {
      setLoading(false);
      setError('当前运行在普通浏览器环境，无法读取漫画页面。请使用 bun run dev 启动 Electron。');
      return;
    }

    let cancelled = false;

    const loadPages = async () => {
      setLoading(true);
      setError(null);
      try {
        const pages = await ipcInvoke('reader.listPages', { mangaId: manga.id });
        if (cancelled) return;
        setPagePaths(pages);
        const initialIndex = Math.max(0, Math.min(manga.lastPageIndex, Math.max(pages.length - 1, 0)));
        setCurrentPageIndex(initialIndex);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : '加载漫画页面失败');
        setPagePaths([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadPages();
    return () => {
      cancelled = true;
    };
  }, [hasIpcBridge, manga.id, manga.lastPageIndex]);

  useEffect(() => {
    if (readerMode !== 'scroll' || pagePaths.length === 0) return;
    const targetIndex = Math.max(0, Math.min(manga.lastPageIndex, pagePaths.length - 1));
    const targetNode = pageRefs.current[targetIndex];
    if (!targetNode) return;
    requestAnimationFrame(() => {
      targetNode.scrollIntoView({ block: 'start' });
    });
  }, [manga.lastPageIndex, pagePaths, readerMode]);

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

  useEffect(() => {
    if (!hasIpcBridge || pagePaths.length === 0) return;
    const timer = setTimeout(() => {
      void ipcInvoke('reader.saveProgress', {
        mangaId: manga.id,
        chapterIndex: 0,
        pageIndex: currentPageIndex,
        totalPages: pagePaths.length
      }).catch(() => undefined);
    }, 280);

    return () => clearTimeout(timer);
  }, [currentPageIndex, hasIpcBridge, manga.id, pagePaths.length]);

  return {
    pagePaths,
    loading,
    error,
    currentPageIndex,
    setCurrentPageIndex,
    scrollContainerRef,
    pageRefs
  };
}
