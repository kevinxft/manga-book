import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Trash2, X } from 'lucide-react';
import { Button } from '@renderer/components/ui/button';
import { VirtualCardGrid } from '@renderer/components/virtual/VirtualCardGrid';
import { cn } from '@renderer/lib/utils';
import { toPageSrc } from '@renderer/pages/Reader/utils';

interface MangaPageEditorDialogProps {
  open: boolean;
  title: string | null;
  pagePaths: string[];
  loading: boolean;
  deleting: boolean;
  error: string | null;
  onClose: () => void;
  onDeleteSelected: (selectedPagePaths: string[]) => void | Promise<void>;
}

interface MangaPageEditorCardProps {
  pagePath: string;
  index: number;
  fileName: string;
  selected: boolean;
  onTogglePage: (pagePath: string) => void;
}

function getFileName(pagePath: string): string {
  return pagePath.split(/[\\/]/).filter(Boolean).pop() ?? pagePath;
}

const MangaPageEditorCard = memo(function MangaPageEditorCard({
  pagePath,
  index,
  fileName,
  selected,
  onTogglePage
}: MangaPageEditorCardProps) {
  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      onTogglePage(pagePath);
    },
    [onTogglePage, pagePath]
  );

  const handleClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }

      event.preventDefault();
      onTogglePage(pagePath);
    },
    [onTogglePage, pagePath]
  );

  return (
    <button
      type="button"
      className="w-full select-none touch-manipulation text-left"
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <article className="group">
        <div
          className={cn(
            'relative overflow-hidden rounded-[22px] border border-transparent bg-[#dfe5ef] shadow-[0_10px_24px_rgba(53,71,95,0.16)]',
            !selected && 'hover:border-[#c8d4e5]'
          )}
        >
          <div className="aspect-[3/4] bg-[#edf2f8]">
            <img
              src={toPageSrc(pagePath)}
              alt={`第 ${index + 1} 页`}
              loading="lazy"
              draggable={false}
              className="pointer-events-none h-full w-full select-none object-contain"
            />
          </div>

          {selected ? (
            <div className="pointer-events-none absolute inset-0 rounded-[22px] border-2 border-[#2f6cf6] bg-[#2f6cf6]/10" />
          ) : null}

          <div className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">
            {index + 1} 页
          </div>

          {selected ? (
            <div className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#2f6cf6] text-white">
              <Check className="h-3.5 w-3.5" />
            </div>
          ) : null}
        </div>

        <p className="mt-2 truncate px-1 text-[11px] font-semibold text-[#203047]" title={fileName}>
          {fileName}
        </p>
      </article>
    </button>
  );
});

export function MangaPageEditorDialog({
  open,
  title,
  pagePaths,
  loading,
  deleting,
  error,
  onClose,
  onDeleteSelected
}: MangaPageEditorDialogProps) {
  const [selectedPagePaths, setSelectedPagePaths] = useState<string[]>([]);
  const selectedPagePathSet = useMemo(() => new Set(selectedPagePaths), [selectedPagePaths]);
  const fileNameByPagePath = useMemo(
    () =>
      Object.fromEntries(
        pagePaths.map((pagePath) => [pagePath, getFileName(pagePath)])
      ) as Record<string, string>,
    [pagePaths]
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedPagePaths([]);
  }, [open, title, pagePaths.length]);

  useEffect(() => {
    setSelectedPagePaths((current) => current.filter((pagePath) => pagePaths.includes(pagePath)));
  }, [pagePaths]);

  const handleTogglePage = useCallback((nextPagePath: string) => {
    setSelectedPagePaths((current) =>
      current.includes(nextPagePath) ? current.filter((item) => item !== nextPagePath) : [...current, nextPagePath]
    );
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose, open]);

  const renderPageCard = useCallback(
    (pagePath: string, index: number) => (
      <MangaPageEditorCard
        pagePath={pagePath}
        index={index}
        fileName={fileNameByPagePath[pagePath] ?? pagePath}
        selected={selectedPagePathSet.has(pagePath)}
        onTogglePage={handleTogglePage}
      />
    ),
    [fileNameByPagePath, handleTogglePage, selectedPagePathSet]
  );

  const handleClearSelection = useCallback(() => {
    setSelectedPagePaths([]);
  }, []);

  const handleDeleteSelection = useCallback(() => {
    void onDeleteSelected(selectedPagePaths);
  }, [onDeleteSelected, selectedPagePaths]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[145] flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <div
        className="flex h-[min(88vh,900px)] w-full max-w-[1120px] flex-col overflow-hidden rounded-[24px] border border-[#d6dfeb] bg-[#f5f7fb] shadow-[0_26px_70px_rgba(18,31,52,0.35)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#dde4ef] bg-white/90 px-6 py-5">
          <div className="min-w-0">
            <p className="truncate text-[18px] font-bold text-[#1d2a3f]" title={title ?? '未选择漫画'}>
              {title ?? '未选择漫画'}
            </p>
            <p className="mt-2 text-[12px] font-semibold text-[#3f5878]">
              共 {pagePaths.length} 页
              {selectedPagePaths.length > 0 ? `，已选 ${selectedPagePaths.length} 页` : ''}
            </p>
          </div>

          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#6f8098] transition hover:bg-[#edf2f9] hover:text-[#304763]"
            onClick={onClose}
            title="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex items-center justify-between gap-3 border-b border-[#dde4ef] bg-[#f7f9fc] px-6 py-3">
          <p className="text-[12px] text-[#6a7890]">点击页面卡片即可多选，删除后会把图片移入系统回收站。</p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              className="h-8 rounded-lg border border-[#d2dbe8] bg-white px-3 text-[12px] font-semibold text-[#4d617f] hover:bg-[#f1f5fb]"
              onClick={handleClearSelection}
              disabled={selectedPagePaths.length === 0 || deleting}
            >
              清空选择
            </Button>
            <Button
              type="button"
              className="h-8 rounded-lg bg-[#c73a3a] px-3 text-[12px] font-semibold text-white hover:bg-[#a83131]"
              onClick={handleDeleteSelection}
              disabled={selectedPagePaths.length === 0 || deleting || loading}
            >
              {deleting ? `移动中...` : `移入回收站 ${selectedPagePaths.length > 0 ? selectedPagePaths.length : ''} 页`}
            </Button>
          </div>
        </div>

        {error ? (
          <div className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="min-h-0 flex-1 px-3">
          {loading ? (
            <div className="flex h-full items-center justify-center text-[13px] font-semibold text-[#5c6e89]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              正在载入漫画页面...
            </div>
          ) : (
            <VirtualCardGrid
              items={pagePaths}
              minColumnWidth={136}
              estimatedCardHeight={(cardWidth) => cardWidth * (4 / 3) + 52}
              gapX={18}
              gapY={14}
              paddingX={12}
              paddingY={0}
              className="h-full overflow-auto"
              initialScrollToIndex={pagePaths.length > 0 ? pagePaths.length - 1 : null}
              initialScrollAlign="end"
              initialScrollKey={title ?? 'page-editor'}
              getItemKey={(pagePath) => pagePath}
              emptyState={
                <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-[#d3dce9] bg-white/70 text-[13px] font-semibold text-[#6a7890]">
                  当前没有可编辑的漫画页面
                </div>
              }
              renderCard={renderPageCard}
            />
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-[#dde4ef] bg-white/80 px-6 py-3 text-[12px] text-[#6a7890]">
          <span>会把所选图片移入系统回收站，建议先确认选择的页数。</span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              className="h-8 rounded-lg border border-[#d2dbe8] bg-white px-3 text-[12px] font-semibold text-[#4d617f] hover:bg-[#f1f5fb]"
              onClick={onClose}
              disabled={deleting}
            >
              关闭
            </Button>
            <Button
              type="button"
              className="h-8 rounded-lg bg-[#c73a3a] px-3 text-[12px] font-semibold text-white hover:bg-[#a83131]"
              onClick={handleDeleteSelection}
              disabled={selectedPagePaths.length === 0 || deleting || loading}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              {deleting ? '移动中...' : '移入回收站'}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
