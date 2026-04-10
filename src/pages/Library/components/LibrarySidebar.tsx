import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownUp,
  BookOpen,
  FolderCog,
  FolderClosed,
  FolderTree,
  Import,
  Pencil,
  Search,
  Settings,
  Tags,
  Trash2,
  X
} from 'lucide-react';
import type { LibraryFolder } from '@shared/types';
import { Input } from '@renderer/components/ui/input';
import { cn } from '@renderer/lib/utils';
import type { OrganizerCategory } from '@renderer/pages/Organizer/types';
import { APP_NAME, APP_VERSION } from '@renderer/constants/appInfo';
import type { TagItem } from '../types';
import { SourceManagerDialog } from './SourceManagerDialog';

interface LibrarySidebarProps {
  sidebarCollapsed: boolean;
  activeMenu: string;
  artistDirectories: OrganizerCategory[];
  tags: TagItem[];
  selectedTags: string[];
  sources: LibraryFolder[];
  sourceMangaCountByPath: Record<string, number>;
  hasIpcBridge: boolean;
  scanRunning: boolean;
  onActiveMenuChange: (value: string) => void;
  onToggleTag: (id: string) => void;
  onClearSelectedTags: () => void;
  onOpenTagDialog: () => void;
  onPickAndAddSources: () => void;
  onOpenSourceFolder: (sourcePath: string) => void;
  onSyncSource: (sourcePath: string) => void;
  onRemoveSource: (sourceId: string) => void;
  onRequestAddAlias: (category: OrganizerCategory) => void;
  onRequestRenameCategory: (category: OrganizerCategory) => void;
  onRequestDeleteCategory: (category: OrganizerCategory) => void;
  onOpenSettings?: () => void;
  onOpenOrganizer?: () => void;
}

interface CategoryContextMenuState {
  x: number;
  y: number;
  category: OrganizerCategory;
}

const CONTEXT_MENU_OFFSET = 6;
const CONTEXT_MENU_PADDING = 8;

export function LibrarySidebar({
  sidebarCollapsed,
  activeMenu,
  artistDirectories,
  tags,
  selectedTags,
  sources,
  sourceMangaCountByPath,
  hasIpcBridge,
  scanRunning,
  onActiveMenuChange,
  onToggleTag,
  onClearSelectedTags,
  onOpenTagDialog,
  onPickAndAddSources,
  onOpenSourceFolder,
  onSyncSource,
  onRemoveSource,
  onRequestAddAlias,
  onRequestRenameCategory,
  onRequestDeleteCategory,
  onOpenSettings,
  onOpenOrganizer
}: LibrarySidebarProps) {
  const [sourceManagerOpen, setSourceManagerOpen] = useState(false);
  const [artistSearch, setArtistSearch] = useState('');
  const [artistSortBy, setArtistSortBy] = useState<'countDesc' | 'countAsc' | 'nameAsc' | 'nameDesc'>('countDesc');
  const [artistSortMenuOpen, setArtistSortMenuOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<CategoryContextMenuState | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState({ left: 0, top: 0 });
  const [contextMenuReady, setContextMenuReady] = useState(false);
  const artistSortMenuRef = useRef<HTMLDivElement | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!artistSortMenuOpen) {
      return;
    }

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (artistSortMenuRef.current && !artistSortMenuRef.current.contains(target)) {
        setArtistSortMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, [artistSortMenuOpen]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    const closeMenu = (event: MouseEvent) => {
      const target = event.target as Node;
      if (contextMenuRef.current && !contextMenuRef.current.contains(target)) {
        setContextMenu(null);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null);
      }
    };

    const closeOnResize = () => {
      setContextMenu(null);
    };

    window.addEventListener('mousedown', closeMenu);
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', closeOnResize, { once: true });

    return () => {
      window.removeEventListener('mousedown', closeMenu);
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', closeOnResize);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!contextMenu) {
      setContextMenuReady(false);
      return;
    }

    const updatePosition = () => {
      if (!contextMenuRef.current) {
        return;
      }

      const rect = contextMenuRef.current.getBoundingClientRect();
      const desiredLeft = contextMenu.x + CONTEXT_MENU_OFFSET;
      const desiredTop = contextMenu.y + CONTEXT_MENU_OFFSET;
      const maxLeft = Math.max(CONTEXT_MENU_PADDING, window.innerWidth - rect.width - CONTEXT_MENU_PADDING);
      const maxTop = Math.max(CONTEXT_MENU_PADDING, window.innerHeight - rect.height - CONTEXT_MENU_PADDING);

      setContextMenuPosition({
        left: Math.min(Math.max(desiredLeft, CONTEXT_MENU_PADDING), maxLeft),
        top: Math.min(Math.max(desiredTop, CONTEXT_MENU_PADDING), maxTop)
      });
      setContextMenuReady(true);
    };

    setContextMenuReady(false);
    const frame = window.requestAnimationFrame(updatePosition);
    return () => window.cancelAnimationFrame(frame);
  }, [contextMenu]);

  const sortedArtistDirectories = useMemo(() => {
    const keyword = artistSearch.trim().toLowerCase();
    const items = artistDirectories.filter(
      (directory) =>
        keyword.length === 0 ||
        directory.label.toLowerCase().includes(keyword) ||
        directory.path.toLowerCase().includes(keyword) ||
        directory.aliases.some((alias) => alias.toLowerCase().includes(keyword))
    );

    items.sort((a, b) => {
      if (artistSortBy === 'countDesc') {
        return b.count - a.count || a.label.localeCompare(b.label, 'zh-Hans-CN');
      }
      if (artistSortBy === 'countAsc') {
        return a.count - b.count || a.label.localeCompare(b.label, 'zh-Hans-CN');
      }
      if (artistSortBy === 'nameAsc') {
        return a.label.localeCompare(b.label, 'zh-Hans-CN');
      }
      return b.label.localeCompare(a.label, 'zh-Hans-CN');
    });

    return items;
  }, [artistDirectories, artistSearch, artistSortBy]);

  return (
    <>
      <aside className="flex h-full min-h-0 flex-col border-r border-slate-200/60 bg-white/50 backdrop-blur-2xl transition-all duration-300">
        <div
          className={cn(
            'flex h-[60px] items-center border-b border-slate-200/50',
            sidebarCollapsed ? 'justify-center px-2' : 'px-5'
          )}
        >
          <div className={cn('flex items-center', sidebarCollapsed ? 'justify-center' : 'gap-3')}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-sm">
              <BookOpen className="h-4 w-4 text-white" />
            </div>
            {!sidebarCollapsed ? (
              <div className="flex flex-col justify-center">
                <div className="flex items-baseline gap-2">
                  <p className="text-[18px] font-black tracking-tight text-slate-800">{APP_NAME}</p>
                  <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-600 ring-1 ring-inset ring-blue-500/10">
                    v{APP_VERSION}
                  </span>
                </div>
                <p className="text-[9px] font-bold tracking-[0.12em] text-slate-400">NEXT GEN READER</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className={cn('flex min-h-0 flex-1 flex-col gap-6 overflow-hidden px-5 py-6', sidebarCollapsed && 'px-2 items-center')}>
          <section className="flex min-h-0 flex-1 flex-col">
            {!sidebarCollapsed ? (
              <div className="mb-4 flex items-center gap-2">
                <div className="relative min-w-0 flex-1 group">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-500" />
                  <Input
                    value={artistSearch}
                    onChange={(event) => setArtistSearch(event.target.value)}
                    className={cn(
                      'h-9 rounded-xl border-slate-200/60 bg-slate-100/50 py-0 pl-9 text-[13px] leading-normal text-slate-700 shadow-sm transition-all focus:border-blue-500/50 focus:bg-white focus:ring-2 focus:ring-blue-500/20',
                      artistSearch.trim().length > 0 ? '!pr-8' : 'pr-3'
                    )}
                    placeholder="搜索"
                  />
                  {artistSearch.trim().length > 0 ? (
                    <button
                      className="absolute right-2 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                      onClick={() => setArtistSearch('')}
                      title="清空搜索"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>

                {artistDirectories.length > 0 ? (
                  <div className="relative" ref={artistSortMenuRef}>
                    <button
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/60 bg-white text-slate-500 shadow-sm transition-all hover:bg-slate-50 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      onClick={() => setArtistSortMenuOpen((prev) => !prev)}
                      title="更改排序"
                    >
                      <ArrowDownUp className="h-4 w-4" />
                    </button>

                    {artistSortMenuOpen ? (
                      <div className="absolute right-0 top-10 z-20 w-36 rounded-lg border border-[#d6deea] bg-white p-1.5 shadow-[0_14px_28px_rgba(48,68,99,0.18)]">
                        {[
                          { key: 'countDesc' as const, label: '漫画本数(多-少)' },
                          { key: 'countAsc' as const, label: '漫画本数(少-多)' },
                          { key: 'nameAsc' as const, label: '名称(A-Z)' },
                          { key: 'nameDesc' as const, label: '名称(Z-A)' }
                        ].map((item) => (
                          <button
                            key={item.key}
                            onClick={() => {
                              setArtistSortBy(item.key);
                              setArtistSortMenuOpen(false);
                            }}
                            className={cn(
                              'flex w-full items-center rounded-md px-2.5 py-2 text-left text-[13px] font-medium transition-colors',
                              artistSortBy === item.key ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                            )}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <button
                onClick={() => onActiveMenuChange('all')}
                title={sidebarCollapsed ? '所有漫画' : undefined}
                className={cn(
                  'shrink-0 flex items-center rounded-xl py-2 text-[13px] font-medium transition-all duration-200 w-full',
                  sidebarCollapsed ? 'justify-center px-0 h-10 w-10 mx-auto' : 'gap-2.5 px-3',
                  activeMenu === 'all'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                )}
              >
                <FolderClosed className="h-4 w-4" />
                {!sidebarCollapsed ? '所有漫画图书' : null}
              </button>

              {!sidebarCollapsed && artistDirectories.length > 0 ? (
                <div className="library-sidebar-scroll mt-2 min-h-0 flex-1 overflow-y-auto pr-1">
                  <div className="space-y-1 pb-1">
                    {sortedArtistDirectories.map((directory) => {
                      const itemKey = `artist:${directory.path}`;
                      const active = activeMenu === itemKey;
                      const aliasText = directory.aliases.length > 0 ? `(${directory.aliases.join(' / ')})` : null;

                      return (
                        <button
                          key={directory.key}
                          onClick={() => onActiveMenuChange(itemKey)}
                          onContextMenu={(event) => {
                            event.preventDefault();
                            onActiveMenuChange(itemKey);
                            setContextMenu({
                              x: event.clientX,
                              y: event.clientY,
                              category: directory
                            });
                          }}
                          className={cn(
                            'group flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[13px] font-medium leading-normal transition-all duration-200',
                            active
                              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                          )}
                          title={aliasText ? `${directory.path}\n${directory.aliases.join(' / ')}` : directory.path}
                        >
                          <span className="inline-flex min-w-0 items-center gap-0.5">
                            <span className="min-w-0 truncate leading-normal">{directory.label}</span>
                            {aliasText ? (
                              <span
                                className={cn(
                                  'min-w-0 truncate text-[10px] ml-1.5 leading-normal',
                                  active ? 'text-white/80' : 'text-slate-400 group-hover:text-slate-500'
                                )}
                              >
                                {aliasText}
                              </span>
                            ) : null}
                          </span>
                          <span className={cn('ml-1.5 shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold', active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200')}>
                            {directory.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          {!sidebarCollapsed ? (
            <section className="flex shrink-0 flex-col overflow-hidden">
              <div className="mb-3 flex items-center justify-between px-2">
                <p className="text-[12px] font-bold tracking-wider text-slate-400">标签过滤</p>
                <div className="flex items-center gap-1">
                  {selectedTags.length > 0 ? (
                    <button
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
                      onClick={onClearSelectedTags}
                    >
                      清空
                    </button>
                  ) : null}
                  <button
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold text-blue-600 transition-colors hover:bg-blue-50"
                    onClick={onOpenTagDialog}
                  >
                    管理
                  </button>
                </div>
              </div>
              {tags.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200/60 bg-slate-50/50 px-4 py-3 text-xs font-medium text-slate-400">
                  暂无标签数据
                </div>
              ) : (
                <div className="library-sidebar-scroll max-h-[140px] overflow-y-auto pr-1">
                  <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => {
                    const active = selectedTags.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        onClick={() => onToggleTag(tag.id)}
                        className={cn(
                          'inline-flex max-w-full items-center justify-center rounded-lg border px-2 py-1 text-[11px] font-semibold leading-none transition-all duration-200',
                          active
                            ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm shadow-blue-500/10'
                            : 'border-slate-200/60 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                        )}
                      >
                        <span className="break-words text-left">{tag.label}</span>
                      </button>
                    );
                  })}
                  </div>
                </div>
              )}
            </section>
          ) : null}
        </div>

        <div 
          className={cn('mt-auto shrink-0 border-t border-slate-200/50 bg-slate-50/30 p-4', sidebarCollapsed && 'px-2')}
          style={{ containerType: 'inline-size', containerName: 'sidebarActions' } as React.CSSProperties}
        >
          <style>{`
            .sidebar-action-grid { display: grid; gap: 0.5rem; grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .sidebar-action-grid.is-collapsed { grid-template-columns: repeat(1, minmax(0, 1fr)); }
            @container sidebarActions (min-width: 310px) {
              .sidebar-action-grid.is-four { grid-template-columns: repeat(4, minmax(0, 1fr)); }
              .sidebar-action-grid.is-three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
            }
            .sidebar-action-import.span-two { grid-column: span 2 / span 2; }
            @container sidebarActions (min-width: 310px) {
              .sidebar-action-import.span-two { grid-column: span 1 / span 1; }
            }
          `}</style>
          <div
            className={cn(
              'sidebar-action-grid items-center',
              sidebarCollapsed ? 'is-collapsed' : (sources.length > 0 ? 'is-four' : 'is-three')
            )}
          >
            <button
              className={cn(
                'sidebar-action-import group flex h-10 w-full items-center rounded-xl py-2 text-[12px] font-bold text-slate-600 transition-all duration-200 hover:bg-blue-50 hover:text-blue-600',
                sidebarCollapsed ? 'justify-center px-0' : 'justify-center gap-1.5 px-3',
                !sidebarCollapsed && sources.length === 0 ? 'span-two' : ''
              )}
              onClick={onPickAndAddSources}
              disabled={!hasIpcBridge}
              title="导入目录"
            >
              <Import className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" />
              {!sidebarCollapsed ? '导入' : null}
            </button>

            {sources.length > 0 ? (
              <button
                className={cn(
                  'group flex h-10 w-full items-center rounded-xl py-2 text-[12px] font-bold text-slate-600 transition-all duration-200 hover:bg-slate-100 hover:text-slate-900',
                  sidebarCollapsed ? 'justify-center px-0' : 'justify-center gap-1.5 px-3'
                )}
                title="管理已导入目录"
                onClick={() => setSourceManagerOpen(true)}
              >
                <FolderCog className="h-4 w-4 transition-transform group-hover:rotate-12" />
                {!sidebarCollapsed ? <span className="rounded-full bg-slate-200/60 px-1.5 py-0.5 text-[10px] leading-none text-slate-600 group-hover:bg-slate-200">{sources.length}</span> : null}
              </button>
            ) : null}

            <button
              className={cn(
                'group flex h-10 w-full items-center rounded-xl py-2 text-[12px] font-bold text-slate-600 transition-all duration-200 hover:bg-slate-100 hover:text-slate-900',
                sidebarCollapsed ? 'justify-center px-0' : 'justify-center gap-1.5 px-3'
              )}
              title="漫画整理"
              onClick={onOpenOrganizer}
            >
              <FolderTree className="h-4 w-4 transition-transform group-hover:scale-110" />
              {!sidebarCollapsed ? '整理' : null}
            </button>

            <button
              className={cn(
                'group flex h-10 w-full items-center rounded-xl py-2 text-[12px] font-bold text-slate-600 transition-all duration-200 hover:bg-slate-100 hover:text-slate-900',
                sidebarCollapsed ? 'justify-center px-0' : 'justify-center gap-1.5 px-3'
              )}
              title="设置"
              onClick={onOpenSettings}
            >
              <Settings className="h-4 w-4 transition-transform group-hover:rotate-90" />
              {!sidebarCollapsed ? '设置' : null}
            </button>
          </div>
        </div>
      </aside>

      <SourceManagerDialog
        open={sourceManagerOpen}
        sources={sources}
        sourceMangaCountByPath={sourceMangaCountByPath}
        hasIpcBridge={hasIpcBridge}
        scanRunning={scanRunning}
        onClose={() => setSourceManagerOpen(false)}
        onOpenSourceFolder={onOpenSourceFolder}
        onSyncSource={onSyncSource}
        onRemoveSource={onRemoveSource}
      />

      {contextMenu ? (
        <div
          ref={contextMenuRef}
          className="fixed z-[90] w-[172px] rounded-lg border border-[#d6deea] bg-white p-1.5 shadow-[0_14px_30px_rgba(36,54,86,0.24)]"
          style={{
            left: contextMenuPosition.left,
            top: contextMenuPosition.top,
            visibility: contextMenuReady ? 'visible' : 'hidden'
          }}
        >
          <button
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] font-semibold text-[#304763] transition hover:bg-[#edf2f9]"
            onClick={() => {
              onRequestRenameCategory(contextMenu.category);
              setContextMenu(null);
            }}
          >
            <Pencil className="h-3.5 w-3.5 text-[#627694]" />
            重命名作者
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] font-semibold text-[#304763] transition hover:bg-[#edf2f9]"
            onClick={() => {
              onRequestAddAlias(contextMenu.category);
              setContextMenu(null);
            }}
          >
            <Tags className="h-3.5 w-3.5 text-[#627694]" />
            添加别名
          </button>
          <button
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] font-semibold transition',
              contextMenu.category.count === 0
                ? 'text-[#b03a3a] hover:bg-[#fdf0f0]'
                : 'cursor-not-allowed text-[#9aa6b8]'
            )}
            onClick={() => {
              if (contextMenu.category.count > 0) {
                return;
              }
              onRequestDeleteCategory(contextMenu.category);
              setContextMenu(null);
            }}
            disabled={contextMenu.category.count > 0}
            title={contextMenu.category.count > 0 ? '仅可删除不包含漫画的作者目录' : '删除该作者目录'}
          >
            <Trash2 className={cn('h-3.5 w-3.5', contextMenu.category.count === 0 ? 'text-[#b03a3a]' : 'text-[#9aa6b8]')} />
            删除目录
          </button>
        </div>
      ) : null}
    </>
  );
}
