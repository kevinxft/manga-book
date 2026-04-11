import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { Check, ChevronsLeft, ChevronsRight, Loader2, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { cn } from '@renderer/lib/utils';
import { useReaderChapterPanelStore } from '@renderer/stores/readerChapterPanelStore';
import type { ReaderChapter } from '@shared/types';

interface ReaderChapterPanelProps {
  mangaId: string;
  visible: boolean;
  chapters: ReaderChapter[];
  currentChapterIndex: number;
  chapterBusy: boolean;
  canAddChapter: boolean;
  canEditChapterMetadata: boolean;
  canAddAtCurrentPage: boolean;
  currentPageIndex: number;
  onAddChapter: () => void;
  onJumpToChapter: (chapter: ReaderChapter) => void;
  onRemoveChapter: (chapter: ReaderChapter) => void;
  onUpdateChapter: (chapter: ReaderChapter, input: { title?: string | null; highlighted?: boolean }) => void;
}

function formatPageRange(chapter: ReaderChapter): string {
  const start = chapter.startPageIndex + 1;
  const end = chapter.endPageIndex + 1;
  return start === end ? `${start}` : `${start}-${end}`;
}

function getChapterLabel(chapter: ReaderChapter, index: number): string {
  if (chapter.source === 'filesystem') {
    return chapter.title;
  }

  return String(index + 1).padStart(2, '0');
}

export function ReaderChapterPanel({
  mangaId,
  visible,
  chapters,
  currentChapterIndex,
  chapterBusy,
  canAddChapter,
  canEditChapterMetadata,
  canAddAtCurrentPage,
  currentPageIndex,
  onAddChapter,
  onJumpToChapter,
  onRemoveChapter,
  onUpdateChapter
}: ReaderChapterPanelProps) {
  const [editing, setEditing] = useState(false);
  const [draftTitlesById, setDraftTitlesById] = useState<Record<string, string>>({});

  const hasChapters = chapters.length > 0;
  const hasEditableChapters = chapters.some((chapter) => chapter.deletable);
  const hasEditingTools = hasEditableChapters || canAddChapter || canEditChapterMetadata;
  const mode = useReaderChapterPanelStore(
    useMemo(
      () => (state) => state.modeByMangaId[mangaId] ?? (hasChapters ? 'normal' : 'mini'),
      [hasChapters, mangaId]
    )
  );
  const setMode = useReaderChapterPanelStore((state) => state.setMode);
  const syncMode = useReaderChapterPanelStore((state) => state.syncMode);

  useEffect(() => {
    syncMode(mangaId, hasChapters);
    setEditing(false);
  }, [hasChapters, mangaId, syncMode]);

  useEffect(() => {
    setDraftTitlesById(Object.fromEntries(chapters.map((chapter) => [chapter.id, chapter.title])));
  }, [chapters, mangaId]);

  useEffect(() => {
    if (!hasEditingTools && editing) {
      setEditing(false);
    }
  }, [editing, hasEditingTools]);

  const updateDraftTitle = (chapterId: string, value: string) => {
    setDraftTitlesById((current) => ({
      ...current,
      [chapterId]: value
    }));
  };

  const resetDraftTitle = (chapter: ReaderChapter) => {
    setDraftTitlesById((current) => ({
      ...current,
      [chapter.id]: chapter.title
    }));
  };

  const commitDraftTitle = (chapter: ReaderChapter) => {
    const draftTitle = (draftTitlesById[chapter.id] ?? chapter.title).trim();
    if (draftTitle === chapter.title.trim()) {
      return;
    }

    onUpdateChapter(chapter, {
      title: draftTitle.length > 0 ? draftTitle : null
    });
  };

  const handleDraftKeyDown = (event: KeyboardEvent<HTMLInputElement>, chapter: ReaderChapter) => {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
      return;
    }

    if (event.key === 'Escape') {
      resetDraftTitle(chapter);
      event.currentTarget.blur();
    }
  };

  if (!visible) {
    return null;
  }

  if (mode === 'mini') {
    return (
      <aside
        className={cn(
          'group/panel pointer-events-auto absolute right-6 top-20 z-30 flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-[#0f1115]/70 p-1.5 text-white shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl transition-[width,background-color,shadow] duration-300 ease-in-out hover:bg-[#0f1115]/85 hover:shadow-[0_24px_60px_rgba(0,0,0,0.6)]',
          hasChapters ? 'w-[64px]' : 'w-11'
        )}
      >
        <button
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 text-[#8ea0b8] transition-all hover:bg-[#2f7fe6] hover:text-white"
          onClick={() => {
            setMode(mangaId, 'normal');
            setEditing(!hasChapters);
          }}
          title="展开章节列表"
        >
          <ChevronsLeft className="h-4 w-4" />
        </button>

        {hasChapters && (
          <div className="flex w-full flex-col gap-1.5 transition-all duration-300">
            <div className="h-px w-full bg-white/5 mx-auto max-w-[20px]" />
            <div className="max-h-[calc(100vh-240px)] space-y-1.5 overflow-y-auto overflow-x-hidden px-1 pb-2 custom-scrollbar">
              {chapters.map((chapter, index) => {
                const active = index === currentChapterIndex;

                return (
                  <button
                    key={chapter.id}
                    className={cn(
                      'relative flex h-8 w-full items-center justify-center rounded-lg text-[11px] font-bold transition-all duration-200',
                      active
                        ? 'bg-[#2f7fe6]/20 text-[#3d8fff] ring-1 ring-[#2f7fe6]/40 shadow-[0_0_12px_rgba(47,127,230,0.2)]'
                        : chapter.highlighted
                          ? 'bg-[#f4b53f]/12 text-[#f7cb74] ring-1 ring-[#f4b53f]/30 shadow-[0_0_12px_rgba(244,181,63,0.16)] hover:bg-[#f4b53f]/18'
                          : 'text-[#8ea0b8] hover:bg-white/10 hover:text-white'
                    )}
                    onClick={() => onJumpToChapter(chapter)}
                    title={chapter.title}
                  >
                    {active && <div className="absolute -left-0.5 top-1.5 h-5 w-1 rounded-full bg-[#2f7fe6] shadow-[0_0_8px_#2f7fe6]" />}
                    {chapter.highlighted && !active ? (
                      <Star className="absolute right-1.5 top-1.5 h-2.5 w-2.5 fill-current text-[#f4b53f]" />
                    ) : null}
                    {getChapterLabel(chapter, index)}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </aside>
    );
  }

  return (
    <aside className="pointer-events-auto absolute right-6 top-20 z-30 flex w-[220px] flex-col overflow-hidden rounded-[22px] border border-white/10 bg-gradient-to-b from-[#1a1c22]/90 to-[#0f1115]/90 text-white shadow-[0_32px_80px_rgba(0,0,0,0.6)] backdrop-blur-3xl transition-[width,background-color,shadow] duration-300 ease-in-out">
      <div className="flex items-center justify-between border-b border-white/5 bg-white/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[#2f7fe6] shadow-[0_0_8px_#2f7fe6]" />
          <span className="text-[13px] font-bold tracking-tight text-[#dfe7f4]">章节目录</span>
          {chapters.length > 0 && (
            <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-[#8ea0b8]">
              {chapters.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {hasEditingTools && (
            <button
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-200',
                editing
                  ? 'bg-[#2f7fe6] text-white shadow-[0_0_10px_rgba(47,127,230,0.4)]'
                  : 'text-[#8ea0b8] hover:bg-white/10 hover:text-white'
              )}
              onClick={() => setEditing((prev) => !prev)}
              title={editing ? '完成编辑' : '编辑列表'}
            >
              {editing ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
            </button>
          )}
          <button
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#8ea0b8] transition-all hover:bg-white/10 hover:text-white"
            onClick={() => {
              setMode(mangaId, 'mini');
              setEditing(false);
            }}
            title="收起为 Mini 模式"
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="max-h-[calc(100vh-220px)] flex-1 space-y-2 overflow-auto px-3 pt-3 pb-6 transition-all custom-scrollbar">
        {hasChapters ? (
          chapters.map((chapter, index) => {
            const active = index === currentChapterIndex;
            const draftTitle = draftTitlesById[chapter.id] ?? chapter.title;

            return (
              <div
                key={chapter.id}
                className={cn(
                  'group relative overflow-hidden rounded-xl border transition-all duration-200',
                  active
                    ? chapter.highlighted
                      ? 'border-[#f4b53f]/45 bg-[linear-gradient(135deg,rgba(47,127,230,0.16),rgba(244,181,63,0.14))] shadow-[0_8px_24px_rgba(0,0,0,0.24)]'
                      : 'border-[#2f7fe6]/40 bg-[#2f7fe6]/12 shadow-[0_8px_20px_rgba(0,0,0,0.2)]'
                    : chapter.highlighted
                      ? 'border-[#f4b53f]/28 bg-[#f4b53f]/8 shadow-[0_6px_16px_rgba(244,181,63,0.12)] hover:border-[#f4b53f]/45 hover:bg-[#f4b53f]/12'
                      : 'border-white/5 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.08] hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)]'
                )}
              >
                <div className={cn('relative p-2.5', editing ? 'space-y-2.5' : 'flex items-start gap-3')}>
                  {editing ? (
                    <>
                      <input
                        className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[12px] font-semibold text-[#eef4ff] outline-none transition focus:border-[#2f7fe6]/50 focus:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
                        value={draftTitle}
                        onChange={(event) => updateDraftTitle(chapter.id, event.target.value)}
                        onBlur={() => commitDraftTitle(chapter)}
                        onKeyDown={(event) => handleDraftKeyDown(event, chapter)}
                        disabled={chapterBusy || !canEditChapterMetadata}
                        placeholder="章节名"
                      />

                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2 opacity-80">
                          <span
                            className={cn(
                              'text-[10px] font-bold uppercase tracking-wider',
                              active ? 'text-[#3d8fff]' : chapter.highlighted ? 'text-[#f4b53f]' : 'text-[#5c6d85]'
                            )}
                          >
                            CH.{String(index + 1).padStart(2, '0')}
                          </span>
                          <span
                            className={cn(
                              'text-[10px] font-semibold',
                              active ? 'text-[#2f7fe6]' : chapter.highlighted ? 'text-[#f4b53f]' : 'text-[#90a0b7]'
                            )}
                          >
                            P.{formatPageRange(chapter)}
                          </span>
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          {canEditChapterMetadata ? (
                            <button
                              className={cn(
                                'flex h-8 w-8 items-center justify-center rounded-lg transition-all',
                                chapter.highlighted
                                  ? 'bg-[#f4b53f]/16 text-[#f4b53f] shadow-[0_0_10px_rgba(244,181,63,0.18)]'
                                  : 'bg-white/5 text-[#7d8ea7] hover:bg-[#f4b53f]/12 hover:text-[#f4b53f]'
                              )}
                              onClick={() => onUpdateChapter(chapter, { highlighted: !chapter.highlighted })}
                              disabled={chapterBusy}
                              title={chapter.highlighted ? '取消高亮' : '设为高亮'}
                            >
                              <Star className={cn('h-3.5 w-3.5', chapter.highlighted ? 'fill-current' : '')} />
                            </button>
                          ) : null}

                          {chapter.deletable ? (
                            <button
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-red-400 transition-all hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                              onClick={() => onRemoveChapter(chapter)}
                              disabled={chapterBusy}
                              title="删除此章节"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </>
                  ) : (
                    <button
                      className="flex min-w-0 flex-1 flex-col text-left"
                      onClick={() => onJumpToChapter(chapter)}
                      title={`${chapter.title} · ${formatPageRange(chapter)}`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'text-[10px] font-bold uppercase tracking-wider',
                            active ? 'text-[#3d8fff]' : chapter.highlighted ? 'text-[#f4b53f]' : 'text-[#5c6d85]'
                          )}
                        >
                          CH.{String(index + 1).padStart(2, '0')}
                        </span>
                        <span
                          className={cn(
                            'truncate text-[12px] font-bold leading-tight',
                            active ? 'text-white' : 'text-[#dfe7f4]/90'
                          )}
                        >
                          {chapter.title}
                        </span>
                        {chapter.highlighted ? <Star className="h-3.5 w-3.5 shrink-0 fill-current text-[#f4b53f]" /> : null}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 opacity-80">
                        <span
                          className={cn(
                            'text-[10px] font-semibold',
                            active ? 'text-[#2f7fe6]' : chapter.highlighted ? 'text-[#f4b53f]' : 'text-[#90a0b7]'
                          )}
                        >
                          P.{formatPageRange(chapter)}
                        </span>
                      </div>
                    </button>
                  )}

                  {active && (
                    <div className="absolute right-0 top-0 h-full w-1 bg-[#2f7fe6] shadow-[-2px_0_12px_rgba(47,127,230,0.4)]" />
                  )}
                  {chapter.highlighted && !active ? (
                    <div className="absolute left-0 top-0 h-full w-1 bg-[#f4b53f] shadow-[2px_0_12px_rgba(244,181,63,0.28)]" />
                  ) : null}
                </div>
              </div>
            );
          })
        ) : !editing && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-2 h-10 w-10 flex items-center justify-center rounded-full bg-white/5 text-[#4b5563]">
               <ChevronsLeft className="h-5 w-5" />
            </div>
            <p className="text-[11px] font-medium text-[#4b5563]">暂无章节信息</p>
          </div>
        )}

        {editing && canAddChapter && (
          <button
            className={cn(
              'group relative flex w-full items-center gap-3 overflow-hidden rounded-xl border border-dashed p-2.5 transition-all duration-200',
              canAddAtCurrentPage && !chapterBusy
                ? 'border-[#2f7fe6]/50 bg-[#2f7fe6]/5 text-[#dfe7f4] hover:bg-[#2f7fe6]/12 hover:border-[#2f7fe6]'
                : 'cursor-not-allowed border-white/10 bg-white/[0.02] text-[#4b5563]'
            )}
            onClick={onAddChapter}
            disabled={!canAddAtCurrentPage || chapterBusy}
            title={canAddAtCurrentPage ? '在当前页标记为新章节起始' : '请先翻到需要作为新章节起始的页面'}
          >
            <div className={cn(
              'flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
              canAddAtCurrentPage ? 'bg-[#2f7fe6]/20 text-[#2f7fe6] group-hover:bg-[#2f7fe6] group-hover:text-white' : 'bg-white/5 text-[#4b5563]'
            )}>
              {chapterBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            </div>
            <div className="flex min-w-0 flex-1 flex-col text-left">
              <span className="text-[12px] font-bold">新增章节点</span>
              <span className="text-[10px] opacity-70">
                {canAddAtCurrentPage ? `起始于第 ${currentPageIndex + 1} 页` : '翻至新页以添加'}
              </span>
            </div>
          </button>
        )}
      </div>

       {editing && chapters.length > 0 && (
         <div className="border-t border-white/5 bg-white/5 px-3 py-2 text-center">
           <p className="text-[9px] font-medium text-[#5c6d85]">
             星标是高亮，输入框可直接改章节名
           </p>
         </div>
       )}
    </aside>
  );
}
