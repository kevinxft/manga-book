import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowUp } from 'lucide-react';
import { cn } from '@renderer/lib/utils';

interface VirtualCardGridProps<T> {
  items: T[];
  minColumnWidth: number;
  estimatedCardHeight: number | ((cardWidth: number) => number);
  gapX: number;
  gapY: number;
  paddingX: number;
  paddingY: number;
  overscan?: number;
  className?: string;
  dataScrollRegion?: string;
  emptyState?: ReactNode;
  onVisibleItemsChange?: (items: T[]) => void;
  initialScrollToIndex?: number | null;
  initialScrollAlign?: 'auto' | 'start' | 'center' | 'end';
  initialScrollKey?: string | number | null;
  showScrollToTopButton?: boolean;
  scrollToTopLabel?: string;
  scrollToTopKey?: string | number | null;
  getItemKey?: (item: T, index: number) => string | number;
  renderCard: (item: T, index: number) => ReactNode;
}

export function VirtualCardGrid<T>({
  items,
  minColumnWidth,
  estimatedCardHeight,
  gapX,
  gapY,
  paddingX,
  paddingY,
  overscan = 4,
  className,
  dataScrollRegion,
  emptyState,
  onVisibleItemsChange,
  initialScrollToIndex = null,
  initialScrollAlign = 'start',
  initialScrollKey = null,
  showScrollToTopButton = false,
  scrollToTopLabel = '返回顶部',
  scrollToTopKey = null,
  getItemKey,
  renderCard
}: VirtualCardGridProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const appliedInitialScrollKeyRef = useRef<string | number | null>(null);
  const appliedScrollToTopKeyRef = useRef<string | number | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [scrollToTopVisible, setScrollToTopVisible] = useState(false);
  const [scrollToTopOffset, setScrollToTopOffset] = useState({ right: 20, bottom: 20 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      const nextWidth = entry?.contentRect.width ?? 0;
      setContainerWidth(nextWidth);
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const updateScrollToTopButton = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      setScrollToTopVisible(false);
      return;
    }

    const rect = container.getBoundingClientRect();
    setScrollToTopVisible(container.scrollTop > 280 && container.scrollHeight > container.clientHeight + 40);
    setScrollToTopOffset({
      right: Math.max(16, window.innerWidth - rect.right + 20),
      bottom: Math.max(16, window.innerHeight - rect.bottom + 20)
    });
  }, []);

  useEffect(() => {
    if (!showScrollToTopButton) {
      setScrollToTopVisible(false);
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    let frameId = 0;
    const scheduleUpdate = () => {
      if (frameId) {
        return;
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        updateScrollToTopButton();
      });
    };

    scheduleUpdate();
    container.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      container.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, [containerWidth, items.length, showScrollToTopButton, updateScrollToTopButton]);

  const columnCount = useMemo(() => {
    const availableWidth = Math.max(0, containerWidth - paddingX * 2);
    if (availableWidth <= 0) {
      return 1;
    }
    return Math.max(1, Math.floor((availableWidth + gapX) / (minColumnWidth + gapX)));
  }, [containerWidth, gapX, minColumnWidth, paddingX]);

  const columnWidth = useMemo(() => {
    const availableWidth = Math.max(0, containerWidth - paddingX * 2);
    if (availableWidth <= 0 || columnCount <= 0) {
      return minColumnWidth;
    }

    return Math.max(0, (availableWidth - gapX * (columnCount - 1)) / columnCount);
  }, [columnCount, containerWidth, gapX, minColumnWidth, paddingX]);

  const estimatedRowHeight = useMemo(() => {
    if (typeof estimatedCardHeight === 'function') {
      return estimatedCardHeight(columnWidth);
    }
    return estimatedCardHeight;
  }, [columnWidth, estimatedCardHeight]);

  const rowCount = Math.ceil(items.length / columnCount);
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => containerRef.current,
    estimateSize: () => estimatedRowHeight + gapY,
    overscan
  });

  const virtualRows = rowVirtualizer.getVirtualItems();

  useEffect(() => {
    if (!onVisibleItemsChange || items.length === 0 || virtualRows.length === 0) {
      return;
    }

    const nextVisibleItems: T[] = [];
    for (const row of virtualRows) {
      const rowStartIndex = row.index * columnCount;
      const rowEndIndex = Math.min(rowStartIndex + columnCount, items.length);

      for (let index = rowStartIndex; index < rowEndIndex; index += 1) {
        const item = items[index];
        if (item) {
          nextVisibleItems.push(item);
        }
      }
    }
    onVisibleItemsChange(nextVisibleItems);
  }, [columnCount, items, onVisibleItemsChange, virtualRows]);

  useEffect(() => {
    if (items.length === 0 || initialScrollToIndex === null || rowCount <= 0 || containerWidth <= 0) {
      return;
    }

    if (appliedInitialScrollKeyRef.current === initialScrollKey) {
      return;
    }

    appliedInitialScrollKeyRef.current = initialScrollKey;

    const clampedIndex = Math.max(0, Math.min(initialScrollToIndex, items.length - 1));
    const rowIndex = Math.floor(clampedIndex / Math.max(columnCount, 1));

    let firstFrameId = 0;
    let secondFrameId = 0;

    firstFrameId = window.requestAnimationFrame(() => {
      secondFrameId = window.requestAnimationFrame(() => {
        rowVirtualizer.scrollToIndex(rowIndex, {
          align: initialScrollAlign
        });

        if (initialScrollAlign === 'end' && clampedIndex === items.length - 1) {
          const container = containerRef.current;
          if (container) {
            container.scrollTop = container.scrollHeight;
          }
        }
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrameId);
      window.cancelAnimationFrame(secondFrameId);
    };
  }, [columnCount, containerWidth, initialScrollAlign, initialScrollKey, initialScrollToIndex, items.length, rowCount, rowVirtualizer]);

  useEffect(() => {
    if (scrollToTopKey === null || appliedScrollToTopKeyRef.current === scrollToTopKey) {
      return;
    }

    appliedScrollToTopKeyRef.current = scrollToTopKey;
    const container = containerRef.current;
    if (!container) {
      return;
    }

    container.scrollTo({ top: 0, behavior: 'auto' });
    setScrollToTopVisible(false);
  }, [scrollToTopKey]);

  const handleScrollToTop = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    container.scrollTo({
      top: 0,
      behavior: reduceMotion ? 'auto' : 'smooth'
    });
  }, []);

  return (
    <>
      <div
        ref={containerRef}
        className={className}
        data-scroll-region={dataScrollRegion}
      >
        {items.length === 0 ? emptyState : null}

        {items.length > 0 ? (
          <div
            className="relative w-full"
            style={{ height: rowVirtualizer.getTotalSize() + paddingY * 2 }}
          >
            {virtualRows.map((row) => {
              const startIndex = row.index * columnCount;
              const endIndex = Math.min(startIndex + columnCount, items.length);
              const rowItems = items.slice(startIndex, endIndex);

              return (
                <div
                  key={row.key}
                  className="absolute left-0 w-full"
                  style={{
                    top: row.start + paddingY,
                    paddingLeft: paddingX,
                    paddingRight: paddingX,
                    paddingBottom: row.index === rowCount - 1 ? 0 : gapY
                  }}
                >
                  <div
                    className="grid"
                    style={{
                      gap: `0px ${gapX}px`,
                      gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`
                    }}
                  >
                    {rowItems.map((item, itemIndex) => {
                      const absoluteIndex = startIndex + itemIndex;
                      const key = getItemKey ? getItemKey(item, absoluteIndex) : absoluteIndex;
                      return (
                        <div key={key} className="contents">
                          {renderCard(item, absoluteIndex)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {showScrollToTopButton ? (
        <button
          type="button"
          className={cn(
            'fixed z-50 inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200/60 bg-white/90 text-slate-500 shadow-[0_8px_30px_rgba(0,0,0,0.12)] backdrop-blur-md transition-all duration-300 hover:scale-105 hover:border-slate-200 hover:bg-white hover:text-blue-600 hover:shadow-[0_12px_40px_rgba(47,108,246,0.15)] focus:outline-none focus:ring-2 focus:ring-blue-500/30 active:scale-95',
            scrollToTopVisible ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
          )}
          style={{
            right: scrollToTopOffset.right,
            bottom: scrollToTopOffset.bottom
          }}
          onClick={handleScrollToTop}
          title={scrollToTopLabel}
          aria-label={scrollToTopLabel}
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      ) : null}
    </>
  );
}
