import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

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
  renderCard
}: VirtualCardGridProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

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

  return (
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
                  {rowItems.map((item, itemIndex) => renderCard(item, startIndex + itemIndex))}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
