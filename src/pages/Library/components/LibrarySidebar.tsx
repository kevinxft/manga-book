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
      <aside className="flex h-full min-h-0 flex-col border-r border-[#dce1ea] bg-[#f6f7f9]">
        <div
          className={cn(
            'flex h-[54px] items-center border-b border-[#e2e6ee]',
            sidebarCollapsed ? 'justify-center px-2' : 'px-4'
          )}
        >
          <div className={cn('flex items-center', sidebarCollapsed ? 'justify-center' : 'gap-2')}>
            <BookOpen className="h-5 w-5 text-[#2563eb]" />
            {!sidebarCollapsed ? (
              <div>
                <div className="flex items-end gap-1.5">
                  <p className="text-[22px] font-bold leading-none tracking-tight text-[#1e2a3a]">{APP_NAME}</p>
                  <span className="mb-0.5 rounded-md bg-[#e7edf8] px-1.5 py-0.5 text-[9px] font-semibold text-[#6b7d98]">
                    v{APP_VERSION}
                  </span>
                </div>
                <p className="mt-0.5 text-[9px] font-semibold tracking-[0.08em] text-[#7e8a9a]">MANGA BOOK</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className={cn('flex min-h-0 flex-1 flex-col gap-5 overflow-hidden px-4 py-5', sidebarCollapsed && 'px-2')}>
          <section className="flex min-h-0 flex-1 flex-col">
            {!sidebarCollapsed ? (
              <div className="mb-3 flex items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b98ac]" />
                  <Input
                    value={artistSearch}
                    onChange={(event) => setArtistSearch(event.target.value)}
                    className="h-9 rounded-lg border-[#d6deea] bg-[#eef2f8] py-0 pl-9 pr-9 text-[12px] leading-normal"
                    placeholder="搜索目录..."
                  />
                  {artistSearch.trim().length > 0 ? (
                    <button
                      className="absolute right-2 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md text-[#70829c] transition hover:bg-[#dfe7f4] hover:text-[#4e607a]"
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
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#dce2ec] bg-[#eceff4] text-[#5f6c80] hover:bg-[#e2e7f0]"
                      onClick={() => setArtistSortMenuOpen((prev) => !prev)}
                      title="排序"
                    >
                      <ArrowDownUp className="h-4 w-4 text-[#5e6c80]" />
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
                              'flex w-full items-center rounded-md px-2.5 py-2 text-left text-xs font-semibold transition',
                              artistSortBy === item.key ? 'bg-[#e7efff] text-[#2f6cf6]' : 'text-[#4f5d73] hover:bg-[#edf2f9]'
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
                  'shrink-0 flex w-full items-center rounded-lg py-1.5 text-[12px] font-semibold transition',
                  sidebarCollapsed ? 'justify-center px-0' : 'gap-1.5 px-2.5',
                  activeMenu === 'all'
                    ? 'bg-[#2f6cf6] text-white shadow-[0_6px_18px_rgba(47,108,246,0.25)]'
                    : 'text-[#2f3b4c] hover:bg-[#e7ebf2]'
                )}
              >
                <FolderClosed className="h-3.5 w-3.5" />
                {!sidebarCollapsed ? '所有漫画' : null}
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
                            'flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold leading-normal transition',
                            active
                              ? 'bg-[#2f6cf6] text-white shadow-[0_6px_18px_rgba(47,108,246,0.2)]'
                              : 'text-[#3a4a62] hover:bg-[#e7ebf2]'
                          )}
                          title={aliasText ? `${directory.path}\n${directory.aliases.join(' / ')}` : directory.path}
                        >
                          <span className="inline-flex min-w-0 items-center gap-0.5">
                            <span className="min-w-0 truncate leading-normal">{directory.label}</span>
                            {aliasText ? (
                              <span
                                className={cn(
                                  'min-w-0 truncate text-[9px] leading-normal',
                                  active ? 'text-white/80' : 'text-[#6f7f98]'
                                )}
                              >
                                {aliasText}
                              </span>
                            ) : null}
                          </span>
                          <span className={cn('ml-1.5 shrink-0 text-[9px]', active ? 'text-white/85' : 'text-[#6f7f98]')}>
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
                <p className="text-[11px] font-semibold text-[#8893a4]">标签过滤</p>
                <div className="flex items-center gap-1">
                  {selectedTags.length > 0 ? (
                    <button
                      className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-[#7a869b] hover:bg-[#edf2f9]"
                      onClick={onClearSelectedTags}
                    >
                      清空
                    </button>
                  ) : null}
                  <button
                    className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-[#2f6cf6] hover:bg-[#e7efff]"
                    onClick={onOpenTagDialog}
                  >
                    管理
                  </button>
                </div>
              </div>
              {tags.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#d4dbe7] bg-[#f8fafd] px-3 py-2 text-xs text-[#8c97aa]">
                  暂无标签数据
                </div>
              ) : (
                <div className="library-sidebar-scroll max-h-[132px] overflow-y-auto pr-1">
                  <div className="flex flex-wrap gap-1">
                  {tags.map((tag) => {
                    const active = selectedTags.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        onClick={() => onToggleTag(tag.id)}
                        className={cn(
                          'inline-flex max-w-full items-center justify-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold leading-4 transition',
                          active
                            ? 'border-[#2f6cf6] bg-[#2f6cf6] text-white'
                            : 'border-[#d4dce8] bg-white text-[#51627c] hover:bg-[#edf2f9]'
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
          className={cn('mt-auto shrink-0 border-t border-[#dce1ea] p-3.5', sidebarCollapsed && 'px-2')}
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
                'sidebar-action-import flex h-9 w-full items-center rounded-lg py-1.5 text-[12px] font-semibold text-[#2f3b4c] transition hover:bg-[#e7ebf2]',
                sidebarCollapsed ? 'justify-center px-0' : 'justify-center gap-1.5 px-2.5',
                !sidebarCollapsed && sources.length === 0 ? 'span-two' : ''
              )}
              onClick={onPickAndAddSources}
              disabled={!hasIpcBridge}
              title="导入目录"
            >
              <Import className="h-3.5 w-3.5" />
              {!sidebarCollapsed ? '导入' : null}
            </button>

            {sources.length > 0 ? (
              <button
                className={cn(
                  'flex h-9 w-full items-center rounded-lg py-1.5 text-[12px] font-semibold text-[#2f3b4c] transition hover:bg-[#e7ebf2]',
                  sidebarCollapsed ? 'justify-center px-0' : 'justify-center gap-1.5 px-2.5'
                )}
                title="管理已导入目录"
                onClick={() => setSourceManagerOpen(true)}
              >
                <FolderCog className="h-3.5 w-3.5" />
                {!sidebarCollapsed ? <span>{sources.length}</span> : null}
              </button>
            ) : null}

            <button
              className={cn(
                'flex h-9 w-full items-center rounded-lg py-1.5 text-[12px] font-semibold text-[#2f3b4c] hover:bg-[#e7ebf2]',
                sidebarCollapsed ? 'justify-center px-0' : 'justify-center gap-1.5 px-2.5'
              )}
              title="设置"
              onClick={onOpenSettings}
            >
              <Settings className="h-3.5 w-3.5" />
              {!sidebarCollapsed ? '设置' : null}
            </button>

            <button
              className={cn(
                'flex h-9 w-full items-center rounded-lg py-1.5 text-[12px] font-semibold text-[#2f3b4c] hover:bg-[#e7ebf2]',
                sidebarCollapsed ? 'justify-center px-0' : 'justify-center gap-1.5 px-2.5'
              )}
              title="漫画整理"
              onClick={onOpenOrganizer}
            >
              <FolderTree className="h-3.5 w-3.5" />
              {!sidebarCollapsed ? '整理' : null}
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
