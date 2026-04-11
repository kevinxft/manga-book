import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { Check, ChevronsLeft, Maximize2, Minimize2, Loader2, Pencil, Plus, Star, Trash2, X } from 'lucide-react';
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
  const modeFromStore = useReaderChapterPanelStore(
    useMemo(
      () => (state) => state.modeByMangaId[mangaId] ?? (hasChapters ? 'normal' : 'mini'),
      [hasChapters, mangaId]
    )
  );
  const setMode = useReaderChapterPanelStore((state) => state.setMode);
  const syncMode = useReaderChapterPanelStore((state) => state.syncMode);

  // Use a local state for 'isOpen' since the user wants explicit toggle
  const [isOpen, setIsOpen] = useState(false);

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

  if (!isOpen && !editing) {
    return (
      <button
        className={cn(
          'pointer-events-auto absolute right-6 top-24 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#0f1115]/60 text-[#8ea0b8] shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-2xl transition-all duration-300 hover:scale-110 hover:bg-[#2f7fe6] hover:text-white',
          !hasChapters && 'opacity-0 pointer-events-none'
        )}
        onClick={() => setIsOpen(true)}
        title="展开章节目录"
      >
        <div className="relative">
          <ChevronsLeft className="h-5 w-5" />
          {hasChapters && (
            <div className="absolute -right-2.5 -top-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#2f7fe6] text-[9px] font-bold text-white shadow-lg ring-2 ring-[#0f1115]">
              {chapters.length}
            </div>
          )}
        </div>
      </button>
    );
  }

  if (modeFromStore === 'mini') {
    return (
      <aside
        className="pointer-events-auto absolute right-6 top-24 z-30 flex w-12 flex-col items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-[#0f1115]/90 p-1.5 text-white shadow-[0_24px_50px_rgba(0,0,0,0.6)] backdrop-blur-3xl transition-all duration-300"
      >
        <div className="flex flex-col gap-1">
          <button
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[#627083] transition-all hover:bg-white/10 hover:text-white"
            onClick={() => setIsOpen(false)}
            title="收起面板"
          >
            <X className="h-4 w-4" />
          </button>
          <button
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/5 text-[#8ea0b8] transition-all hover:bg-[#2f7fe6] hover:text-white"
            onClick={() => setMode(mangaId, 'normal')}
            title="切换为完整视图"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>

        <div className="h-px w-full max-w-[20px] bg-white/10" />

        <div className="custom-scrollbar max-h-[calc(100vh-320px)] space-y-1.5 overflow-y-auto overflow-x-hidden px-0.5 pb-2">
          {chapters.map((chapter, index) => {
            const active = index === currentChapterIndex;

            return (
              <button
                key={chapter.id}
                className={cn(
                  'relative flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-bold transition-all duration-300',
                  active
                    ? chapter.highlighted
                      ? 'bg-[#f4b53f]/25 text-[#f4b53f] ring-1 ring-[#f4b53f]/50 shadow-[0_4px_12px_rgba(244,181,63,0.25)]'
                      : 'bg-[#2f7fe6]/20 text-[#3d8fff] ring-1 ring-[#2f7fe6]/40 shadow-[0_0_12px_rgba(47,127,230,0.2)]'
                    : chapter.highlighted
                      ? 'bg-[#f4b53f]/12 text-[#f7cb74] ring-1 ring-[#f4b53f]/30 hover:bg-[#f4b53f]/18'
                      : 'text-[#8ea0b8] hover:bg-white/10 hover:text-white'
                )}
                onClick={() => onJumpToChapter(chapter)}
                title={chapter.title}
              >
                {active && (
                   <div className={cn(
                     "absolute -left-0.5 top-1.5 h-5 w-1 rounded-full",
                     chapter.highlighted ? "bg-[#f4b53f] shadow-[0_0_8px_#f4b53f]" : "bg-[#2f7fe6] shadow-[0_0_8px_#2f7fe6]"
                   )} />
                )}
                {getChapterLabel(chapter, index)}
              </button>
            );
          })}
        </div>
      </aside>
    );
  }

  return (
    <aside
      className="group/panel pointer-events-auto absolute right-6 top-24 z-30 flex w-[240px] flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#0f1115]/90 text-white shadow-[0_32px_80px_rgba(0,0,0,0.6)] backdrop-blur-3xl transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]"
    >
      <div className="flex items-center justify-between border-b border-white/5 bg-white/5 px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="h-5 w-1 rounded-full bg-[#2f7fe6] shadow-[0_0_10px_#2f7fe6]" />
          <span className="text-[13.5px] font-bold tracking-tight text-[#f0f4f9]">章节目录</span>
          {chapters.length > 0 && (
            <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-[#8ea0b8]">
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
            onClick={() => setMode(mangaId, 'mini')}
            title="切换为迷你视图"
          >
            <Minimize2 className="h-4 w-4" />
          </button>
          <button
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#627083] transition-all hover:bg-white/10 hover:text-white"
            onClick={() => setIsOpen(false)}
            title="收起面板"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="max-h-[min(calc(100vh-250px),600px)] flex-1 space-y-2 overflow-y-auto px-3.5 pt-4 pb-8 transition-all custom-scrollbar">
        {hasChapters ? (
          chapters.map((chapter, index) => {
            const active = index === currentChapterIndex;
            const draftTitle = draftTitlesById[chapter.id] ?? chapter.title;

            return (
              <div
                key={chapter.id}
                className={cn(
                  'group relative overflow-hidden rounded-xl border transition-all duration-300',
                  active
                    ? chapter.highlighted
                      ? 'border-[#f4b53f]/60 bg-[#f4b53f]/20 shadow-[0_12px_30px_rgba(0,0,0,0.3),0_0_15px_rgba(244,181,63,0.25)]'
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
                              chapter.highlighted ? 'text-[#f4b53f]' : active ? 'text-[#3d8fff]' : 'text-[#5c6d85]'
                            )}
                          >
                            CH.{String(index + 1).padStart(2, '0')}
                          </span>
                          <span
                            className={cn(
                              'text-[10px] font-semibold',
                              active ? 'text-[#2f7fe6]' : chapter.highlighted ? 'text-[#f4b53f]/90' : 'text-[#90a0b7]'
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
                            'text-[10px] font-bold uppercase tracking-wider transition-colors duration-300',
                            chapter.highlighted ? 'text-[#f4b53f]' : active ? 'text-[#3d8fff]' : 'text-[#5c6d85]'
                          )}
                        >
                          CH.{String(index + 1).padStart(2, '0')}
                        </span>
                        <span
                          className={cn(
                            'truncate text-[12px] font-bold leading-tight transition-colors duration-300',
                            active ? (chapter.highlighted ? 'text-[#f4b53f]' : 'text-white') : 'text-[#dfe7f4]/90'
                          )}
                        >
                          {chapter.title}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 opacity-80">
                        <span
                          className={cn(
                            'text-[10px] font-semibold transition-colors duration-300',
                            chapter.highlighted ? (active ? 'text-[#f4b53f]/90' : 'text-[#f4b53f]/80') : (active ? 'text-[#3d8fff]/90' : 'text-[#90a0b7]')
                          )}
                        >
                          P.{formatPageRange(chapter)}
                        </span>
                      </div>
                    </button>
                  )}

                  {active && (
                    <div className={cn(
                      "absolute right-0 top-0 h-full w-1 transition-all duration-300",
                      chapter.highlighted ? "bg-[#f4b53f] shadow-[-2px_0_12px_rgba(244,181,63,0.5)]" : "bg-[#2f7fe6] shadow-[-2px_0_12px_rgba(47,127,230,0.4)]"
                    )} />
                  )}
                  {chapter.highlighted && !active && (
                    <div className="absolute left-0 top-0 h-full w-1 bg-[#f4b53f] opacity-80 shadow-[2px_0_12px_rgba(244,181,63,0.28)] transition-all duration-300" />
                  )}
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
