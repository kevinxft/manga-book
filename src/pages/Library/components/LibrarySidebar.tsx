import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownUp,
  Folder,
  FolderCog,
  FolderClosed,
  FolderTree,
  Import,
  Loader2,
  Pencil,
  Search,
  Settings,
  Tags,
  Trash2,
  X
} from 'lucide-react';
import type { LibraryFolder } from '@shared/types';
import { Input } from '@renderer/components/ui/input';
import { ipcInvoke } from '@renderer/ipc/client';
import { cn } from '@renderer/lib/utils';
import type { OrganizerCategory } from '@renderer/pages/Organizer/types';
import { categoryMatchesSearch, normalizeSearchText } from '@renderer/pages/Organizer/utils';
import { APP_NAME, APP_VERSION } from '@renderer/constants/appInfo';
import appIconUrl from '../../../../build/icon.png';
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
  importingAuthorDirectoryPath: string | null;
  onRequestImportToCategory: (category: OrganizerCategory) => void;
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
const COLLAPSED_LIBRARY_MENU_OFFSET = 10;
const COLLAPSED_LIBRARY_MENU_PADDING = 12;

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
  importingAuthorDirectoryPath,
  onRequestImportToCategory,
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
  const [collapsedLibraryMenuOpen, setCollapsedLibraryMenuOpen] = useState(false);
  const [collapsedLibraryMenuPosition, setCollapsedLibraryMenuPosition] = useState({ left: 0, top: 0 });
  const [collapsedLibraryMenuReady, setCollapsedLibraryMenuReady] = useState(false);
  const artistSortMenuRef = useRef<HTMLDivElement | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const collapsedLibraryMenuRef = useRef<HTMLDivElement | null>(null);
  const collapsedLibraryMenuTriggerRef = useRef<HTMLButtonElement | null>(null);

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
    if (!sidebarCollapsed) {
      setCollapsedLibraryMenuOpen(false);
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (!collapsedLibraryMenuOpen) {
      return;
    }

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        collapsedLibraryMenuRef.current &&
        !collapsedLibraryMenuRef.current.contains(target) &&
        collapsedLibraryMenuTriggerRef.current &&
        !collapsedLibraryMenuTriggerRef.current.contains(target)
      ) {
        setCollapsedLibraryMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCollapsedLibraryMenuOpen(false);
      }
    };

    const handleResize = () => {
      setCollapsedLibraryMenuOpen(false);
    };

    window.addEventListener('mousedown', handleDocumentClick);
    window.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', handleResize, { once: true });

    return () => {
      window.removeEventListener('mousedown', handleDocumentClick);
      window.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', handleResize);
    };
  }, [collapsedLibraryMenuOpen]);

  useEffect(() => {
    if (!collapsedLibraryMenuOpen) {
      setCollapsedLibraryMenuReady(false);
      return;
    }

    const updatePosition = () => {
      if (!collapsedLibraryMenuRef.current || !collapsedLibraryMenuTriggerRef.current) {
        return;
      }

      const menuRect = collapsedLibraryMenuRef.current.getBoundingClientRect();
      const triggerRect = collapsedLibraryMenuTriggerRef.current.getBoundingClientRect();
      const desiredLeft = triggerRect.right + COLLAPSED_LIBRARY_MENU_OFFSET;
      const desiredTop = triggerRect.top - 8;
      const maxLeft = Math.max(
        COLLAPSED_LIBRARY_MENU_PADDING,
        window.innerWidth - menuRect.width - COLLAPSED_LIBRARY_MENU_PADDING
      );
      const maxTop = Math.max(
        COLLAPSED_LIBRARY_MENU_PADDING,
        window.innerHeight - menuRect.height - COLLAPSED_LIBRARY_MENU_PADDING
      );

      setCollapsedLibraryMenuPosition({
        left: Math.min(Math.max(desiredLeft, COLLAPSED_LIBRARY_MENU_PADDING), maxLeft),
        top: Math.min(Math.max(desiredTop, COLLAPSED_LIBRARY_MENU_PADDING), maxTop)
      });
      setCollapsedLibraryMenuReady(true);
    };

    setCollapsedLibraryMenuReady(false);
    const frame = window.requestAnimationFrame(updatePosition);
    return () => window.cancelAnimationFrame(frame);
  }, [artistDirectories.length, artistSearch, artistSortBy, collapsedLibraryMenuOpen]);

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
    const keyword = normalizeSearchText(artistSearch);
    const items = artistDirectories.filter((directory) => categoryMatchesSearch(directory, keyword));

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
            'app-window-drag app-sidebar-titlebar flex h-[60px] items-center border-b border-slate-200/50',
            sidebarCollapsed ? 'app-sidebar-titlebar--collapsed justify-center px-2' : 'px-5'
          )}
        >
          <div className={cn('flex min-w-0 items-center', sidebarCollapsed ? 'justify-center' : 'w-full gap-3')}>
            <img
              src={appIconUrl}
              alt={APP_NAME}
              className="h-8 w-8 shrink-0 rounded-lg object-cover shadow-sm"
              draggable={false}
            />
            {!sidebarCollapsed ? (
              <div className="min-w-0 flex flex-col justify-center">
                <div className="flex min-w-0 items-baseline gap-2 whitespace-nowrap">
                  <p className="shrink-0 text-[18px] font-black tracking-tight text-slate-800">{APP_NAME}</p>
                  <span className="shrink-0 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-600 ring-1 ring-inset ring-blue-500/10">
                    v{APP_VERSION}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className={cn('flex min-h-0 flex-1 flex-col gap-6 overflow-hidden px-5 pb-6 pt-4', sidebarCollapsed && 'px-2 items-center')}>
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
                ref={sidebarCollapsed ? collapsedLibraryMenuTriggerRef : null}
                onClick={() => {
                  if (sidebarCollapsed) {
                    setCollapsedLibraryMenuOpen((prev) => !prev);
                    return;
                  }
                  onActiveMenuChange('all');
                }}
                title={sidebarCollapsed ? '所有漫画' : undefined}
                className={cn(
                  'shrink-0 flex items-center rounded-xl py-2 text-[13px] font-medium transition-all duration-100 w-full',
                  sidebarCollapsed ? 'justify-center px-0 h-10 w-10 mx-auto' : 'gap-2.5 px-3',
                  activeMenu === 'all' || (sidebarCollapsed && collapsedLibraryMenuOpen)
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                )}
              >
                <FolderClosed className="h-4 w-4" />
                {!sidebarCollapsed ? '所有漫画' : null}
              </button>

              {!sidebarCollapsed && artistDirectories.length > 0 ? (
                <div className="library-sidebar-scroll mt-2 min-h-0 flex-1 overflow-y-auto px-1 py-1">
                  <div className="space-y-1 pb-1">
                    {sortedArtistDirectories.map((directory) => {
                      const itemKey = `artist:${directory.path}`;
                      const active = activeMenu === itemKey;
                      const aliasText = directory.aliases.length > 0 ? directory.aliases.join(' / ') : null;

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
                            'group flex w-full items-center justify-between rounded-xl border px-2.5 py-1.5 text-left transition-all duration-100 focus:outline-none',
                            active
                              ? 'border-blue-500/50 bg-blue-50 shadow-sm'
                              : 'border-transparent bg-transparent hover:border-slate-200/60 hover:bg-white hover:shadow-[0_4px_20px_rgba(30,41,59,0.04)]'
                          )}
                          title={aliasText ? `${directory.path}\n${directory.aliases.join(' / ')}` : directory.path}
                        >
                          <span className="inline-flex min-w-0 flex-1 items-center gap-2.5">
                            <Folder className={cn('h-3.5 w-3.5 shrink-0 transition-colors', active ? 'fill-blue-500/20 text-blue-600' : 'text-blue-400 group-hover:fill-blue-50 group-hover:text-blue-500')} />
                            <span className="inline-flex min-w-0 flex-1 flex-col justify-center">
                              <span className={cn('truncate text-[12px] font-bold tracking-wide transition-colors', active ? 'text-blue-700' : 'text-slate-700 group-hover:text-slate-900')}>
                                {directory.label}
                              </span>
                            {aliasText ? (
                              <span
                                className={cn(
                                  'truncate text-[9px] font-semibold tracking-wide transition-colors',
                                  active ? 'text-blue-500/80' : 'text-slate-400 group-hover:text-slate-500'
                                )}
                                title={aliasText}
                              >
                                {aliasText}
                              </span>
                            ) : null}
                            </span>
                          </span>
                          <span
                            className={cn(
                              'ml-2 shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold transition-all',
                              active ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                            )}
                          >
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
              <div className="mb-2 flex items-center justify-between px-2">
                <p className="text-[11px] font-bold tracking-wider text-slate-400">标签过滤</p>
                <div className="flex items-center gap-1">
                  {selectedTags.length > 0 ? (
                    <button
                      className="rounded-full px-1.5 py-0.5 text-[9px] font-bold text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
                      onClick={onClearSelectedTags}
                    >
                      清空
                    </button>
                  ) : null}
                  <button
                    className="rounded-full px-1.5 py-0.5 text-[9px] font-bold text-blue-600 transition-colors hover:bg-blue-50"
                    onClick={onOpenTagDialog}
                  >
                    管理
                  </button>
                </div>
              </div>
              {tags.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200/60 bg-slate-50/50 px-3 py-2 text-[11px] font-medium text-slate-400">
                  暂无标签数据
                </div>
              ) : (
                <div className="library-sidebar-scroll max-h-[112px] overflow-y-auto pr-1">
                  <div className="flex flex-wrap gap-1">
                  {tags.map((tag) => {
                    const active = selectedTags.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        onClick={() => onToggleTag(tag.id)}
                        className={cn(
                          'inline-flex max-w-full items-center justify-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold leading-none transition-all duration-100',
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
          className={cn('mt-auto shrink-0 border-t border-slate-200/50 bg-slate-50/30 px-3 py-2', sidebarCollapsed && 'px-2')}
          style={{ containerType: 'inline-size', containerName: 'sidebarActions' } as React.CSSProperties}
        >
          <div
            className={cn(
              'sidebar-action-grid items-center',
              sidebarCollapsed ? 'is-collapsed' : 'is-three'
            )}
          >
            <button
              className={cn(
                'sidebar-action-button group flex h-8 w-full items-center justify-center rounded-lg py-1.5 text-[12px] font-bold text-slate-600 transition-all duration-200 hover:bg-slate-100 hover:text-slate-900',
                sidebarCollapsed ? 'px-0' : 'px-2'
              )}
              aria-label={`管理目录 (${sources.length})`}
              onClick={() => setSourceManagerOpen(true)}
            >
              <FolderCog className="h-4 w-4 transition-transform group-hover:rotate-12" />
            </button>

            <button
              className={cn(
                'sidebar-action-button group flex h-8 w-full items-center justify-center rounded-lg py-1.5 text-[12px] font-bold text-slate-600 transition-all duration-200 hover:bg-slate-100 hover:text-slate-900',
                sidebarCollapsed ? 'px-0' : 'px-2'
              )}
              aria-label="设置"
              onClick={onOpenSettings}
            >
              <Settings className="h-4 w-4 transition-transform group-hover:rotate-90" />
            </button>

            <button
              className={cn(
                'sidebar-action-button group flex h-8 w-full items-center justify-center rounded-lg py-1.5 text-[12px] font-bold text-slate-600 transition-all duration-200 hover:bg-slate-100 hover:text-slate-900',
                sidebarCollapsed ? 'px-0' : 'px-2'
              )}
              aria-label="漫画整理"
              onClick={onOpenOrganizer}
            >
              <FolderTree className="h-4 w-4 transition-transform group-hover:scale-110" />
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
        onPickAndAddSources={onPickAndAddSources}
        onOpenSourceFolder={onOpenSourceFolder}
        onSyncSource={onSyncSource}
        onRemoveSource={onRemoveSource}
      />

      {collapsedLibraryMenuOpen ? (
        <div
          ref={collapsedLibraryMenuRef}
          className="fixed z-[95] w-[240px] overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-2 shadow-[0_20px_40px_rgba(30,41,59,0.18)]"
          style={{
            left: collapsedLibraryMenuPosition.left,
            top: collapsedLibraryMenuPosition.top,
            visibility: collapsedLibraryMenuReady ? 'visible' : 'hidden'
          }}
        >
          <div className="flex items-center justify-between border-b border-slate-200/70 px-2.5 pb-2 pt-1">
            <p className="text-[11px] font-bold tracking-[0.16em] text-slate-400">漫画筛选</p>
            <button
              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              onClick={() => setCollapsedLibraryMenuOpen(false)}
              title="关闭"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {artistDirectories.length > 0 ? (
            <div className="mt-2 px-1">
              <div className="group relative min-w-0">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-500" />
                <Input
                  value={artistSearch}
                  onChange={(event) => setArtistSearch(event.target.value)}
                  className={cn(
                    'h-8 rounded-lg border-slate-200/60 bg-slate-100/60 py-0 pl-8 text-[12px] leading-normal text-slate-700 shadow-sm transition-all focus:border-blue-500/50 focus:bg-white focus:ring-2 focus:ring-blue-500/20',
                    artistSearch.trim().length > 0 ? '!pr-7' : 'pr-2.5'
                  )}
                  placeholder="搜索作者"
                />
                {artistSearch.trim().length > 0 ? (
                  <button
                    className="absolute right-1.5 top-1/2 inline-flex h-4.5 w-4.5 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                    onClick={() => setArtistSearch('')}
                    title="清空搜索"
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="mt-2 space-y-1">
            <button
              className={cn(
                'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-semibold transition-all',
                activeMenu === 'all'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              )}
              onClick={() => {
                onActiveMenuChange('all');
                setCollapsedLibraryMenuOpen(false);
              }}
            >
              <FolderClosed className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1">全部漫画</span>
            </button>
          </div>

          {sortedArtistDirectories.length > 0 ? (
            <div className="mt-2 border-t border-slate-200/70 pt-2">
              <div className="library-sidebar-scroll max-h-[min(56vh,420px)] space-y-1 overflow-y-auto pr-1">
                {sortedArtistDirectories.map((directory) => {
                  const itemKey = `artist:${directory.path}`;
                  const active = activeMenu === itemKey;
                  const aliasText = directory.aliases.length > 0 ? directory.aliases.join(' / ') : null;

                  return (
                    <button
                      key={directory.key}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-all',
                        active ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                      )}
                      onClick={() => {
                        onActiveMenuChange(itemKey);
                        setCollapsedLibraryMenuOpen(false);
                      }}
                      title={aliasText ? `${directory.path}\n${aliasText}` : directory.path}
                    >
                      <Folder className={cn('h-4 w-4 shrink-0', active ? 'text-blue-600' : 'text-blue-400')} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-bold">{directory.label}</span>
                        {aliasText ? (
                          <span className="block truncate text-[9px] font-semibold text-slate-400">{aliasText}</span>
                        ) : null}
                      </span>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold',
                          active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                        )}
                      >
                        {directory.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {contextMenu ? (
        <div
          ref={contextMenuRef}
          className="fixed z-[90] w-[196px] rounded-lg border border-[#d6deea] bg-white p-1.5 shadow-[0_14px_30px_rgba(36,54,86,0.24)]"
          style={{
            left: contextMenuPosition.left,
            top: contextMenuPosition.top,
            visibility: contextMenuReady ? 'visible' : 'hidden'
          }}
        >
          <button
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] font-semibold transition',
              hasIpcBridge ? 'text-[#304763] hover:bg-[#edf2f9]' : 'cursor-not-allowed text-[#9aa6b8]'
            )}
            onClick={() => {
              if (!hasIpcBridge) {
                return;
              }
              void ipcInvoke('organizer.searchWeb', {
                provider: 'hitomiArtist',
                query: contextMenu.category.label
              });
              setContextMenu(null);
            }}
            disabled={!hasIpcBridge}
          >
            <Search className={cn('h-3.5 w-3.5', hasIpcBridge ? 'text-[#627694]' : 'text-[#9aa6b8]')} />
            按作者名搜索
          </button>
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
              importingAuthorDirectoryPath === contextMenu.category.path
                ? 'cursor-not-allowed text-[#9aa6b8]'
                : 'text-[#304763] hover:bg-[#edf2f9]'
            )}
            onClick={() => {
              if (importingAuthorDirectoryPath === contextMenu.category.path) {
                return;
              }
              void onRequestImportToCategory(contextMenu.category);
              setContextMenu(null);
            }}
            disabled={importingAuthorDirectoryPath === contextMenu.category.path}
          >
            {importingAuthorDirectoryPath === contextMenu.category.path ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#9aa6b8]" />
            ) : (
              <Import className="h-3.5 w-3.5 text-[#627694]" />
            )}
            导入漫画
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
