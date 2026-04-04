import { useState } from 'react';
import {
  BookOpen,
  FolderCog,
  FolderClosed,
  FolderTree,
  Import,
  PanelLeftClose,
  PanelLeftOpen,
  Settings
} from 'lucide-react';
import type { LibraryFolder } from '@shared/types';
import { Button } from '@renderer/components/ui/button';
import { cn } from '@renderer/lib/utils';
import type { OrganizerCategory } from '@renderer/pages/Organizer/types';
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
  onActiveMenuChange: (value: string) => void;
  onSidebarCollapsedChange: (value: boolean) => void;
  onToggleTag: (id: string) => void;
  onClearSelectedTags: () => void;
  onOpenTagDialog: () => void;
  onPickAndAddSources: () => void;
  onRemoveSource: (sourceId: string) => void;
  onOpenSettings?: () => void;
  onOpenOrganizer?: () => void;
}

export function LibrarySidebar({
  sidebarCollapsed,
  activeMenu,
  artistDirectories,
  tags,
  selectedTags,
  sources,
  sourceMangaCountByPath,
  hasIpcBridge,
  onActiveMenuChange,
  onSidebarCollapsedChange,
  onToggleTag,
  onClearSelectedTags,
  onOpenTagDialog,
  onPickAndAddSources,
  onRemoveSource,
  onOpenSettings,
  onOpenOrganizer
}: LibrarySidebarProps) {
  const [sourceManagerOpen, setSourceManagerOpen] = useState(false);

  return (
    <>
      <aside className="flex h-full min-h-0 flex-col border-r border-[#dce1ea] bg-[#f6f7f9]">
        <div
          className={cn(
            'flex h-16 items-center border-b border-[#e2e6ee]',
            sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-4'
          )}
        >
          <div className={cn('flex items-center', sidebarCollapsed ? 'justify-center' : 'gap-2')}>
            <BookOpen className="h-6 w-6 text-[#2563eb]" />
            {!sidebarCollapsed ? (
              <div>
                <p className="text-[28px] font-bold leading-none tracking-tight text-[#1e2a3a]">漫画库</p>
                <p className="mt-1 text-[10px] font-semibold tracking-[0.1em] text-[#7e8a9a]">MANGA LIBRARY</p>
              </div>
            ) : null}
          </div>
          {!sidebarCollapsed ? (
            <button
              className="rounded-md p-1.5 text-[#7b889c] transition hover:bg-[#e8edf5] hover:text-[#51617a]"
              onClick={() => onSidebarCollapsedChange(true)}
              title="收起侧栏"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className={cn('flex min-h-0 flex-1 flex-col gap-5 overflow-hidden px-4 py-5', sidebarCollapsed && 'px-2')}>
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {!sidebarCollapsed ? <p className="mb-3 px-2 text-xs font-semibold text-[#8893a4]">常规</p> : null}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <button
                onClick={() => onActiveMenuChange('all')}
                title={sidebarCollapsed ? '所有漫画' : undefined}
                className={cn(
                  'shrink-0 flex w-full items-center rounded-lg py-2 text-sm font-semibold transition',
                  sidebarCollapsed ? 'justify-center px-0' : 'gap-2 px-3',
                  activeMenu === 'all'
                    ? 'bg-[#2f6cf6] text-white shadow-[0_6px_18px_rgba(47,108,246,0.25)]'
                    : 'text-[#2f3b4c] hover:bg-[#e7ebf2]'
                )}
              >
                <FolderClosed className="h-4 w-4" />
                {!sidebarCollapsed ? '所有漫画' : null}
              </button>

              {!sidebarCollapsed && artistDirectories.length > 0 ? (
                <div className="library-sidebar-scroll mt-2 min-h-0 flex-1 overflow-y-auto pr-1">
                  <div className="space-y-1.5 pb-1">
                    {artistDirectories.map((directory) => {
                      const itemKey = `artist:${directory.path}`;
                      const active = activeMenu === itemKey;

                      return (
                        <button
                          key={directory.key}
                          onClick={() => onActiveMenuChange(itemKey)}
                          className={cn(
                            'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold transition',
                            active
                              ? 'bg-[#2f6cf6] text-white shadow-[0_6px_18px_rgba(47,108,246,0.2)]'
                              : 'text-[#3a4a62] hover:bg-[#e7ebf2]'
                          )}
                          title={directory.path}
                        >
                          <span className="min-w-0 truncate">{directory.label}</span>
                          <span className={cn('ml-2 shrink-0 text-xs', active ? 'text-white/85' : 'text-[#6f7f98]')}>
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
                <p className="text-xs font-semibold text-[#8893a4]">标签过滤</p>
                <div className="flex items-center gap-1">
                  {selectedTags.length > 0 ? (
                    <button
                      className="rounded-md px-2 py-1 text-[11px] font-semibold text-[#7a869b] hover:bg-[#edf2f9]"
                      onClick={onClearSelectedTags}
                    >
                      清空
                    </button>
                  ) : null}
                  <button
                    className="rounded-md px-2 py-1 text-[11px] font-semibold text-[#2f6cf6] hover:bg-[#e7efff]"
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
                <div className="library-sidebar-scroll max-h-[140px] overflow-y-auto pr-1">
                  <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => {
                    const active = selectedTags.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        onClick={() => onToggleTag(tag.id)}
                        className={cn(
                          'inline-flex max-w-full items-center justify-center rounded-md border px-2 py-1.5 text-xs font-semibold transition',
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

        <div className={cn('mt-auto shrink-0 space-y-3 border-t border-[#dce1ea] p-4', sidebarCollapsed && 'px-2')}>
          {sidebarCollapsed ? (
            <button
              className="flex w-full items-center justify-center rounded-lg border border-[#d7deea] bg-white py-2 text-[#5a6880] transition hover:bg-[#e7ebf2]"
              onClick={() => onSidebarCollapsedChange(false)}
              title="展开侧栏"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          ) : null}

          <div className={cn('grid items-center gap-2', sources.length > 0 ? 'grid-cols-[1fr_auto]' : 'grid-cols-1')}>
            <Button
              className={cn(
                'h-11 rounded-lg bg-[#2f6cf6] text-sm font-semibold text-white hover:bg-[#255de0]',
                sidebarCollapsed && 'h-10 px-0'
              )}
              onClick={onPickAndAddSources}
              disabled={!hasIpcBridge}
              title="导入目录"
            >
              <Import className={cn('h-4 w-4', !sidebarCollapsed && 'mr-2')} />
              {!sidebarCollapsed ? '导入目录' : null}
            </Button>

            {sources.length > 0 ? (
              <button
                className={cn(
                  'inline-flex h-11 items-center justify-center rounded-lg border border-[#d7deea] bg-white px-3 text-[#5a6880] transition hover:bg-[#e7ebf2]',
                  sidebarCollapsed && 'h-10 px-2'
                )}
                title="管理已导入目录"
                onClick={() => setSourceManagerOpen(true)}
              >
                <FolderCog className="h-4 w-4" />
                {!sidebarCollapsed ? <span className="ml-1 text-[12px] font-semibold">{sources.length}</span> : null}
              </button>
            ) : null}
          </div>

          <div className={cn('grid gap-2', sidebarCollapsed ? 'grid-cols-1' : 'grid-cols-2')}>
            <button
              className={cn(
                'flex w-full items-center rounded-lg py-2 text-sm font-semibold text-[#2f3b4c] hover:bg-[#e7ebf2]',
                sidebarCollapsed ? 'justify-center px-0' : 'justify-center gap-2 px-3'
              )}
              title="漫画整理"
              onClick={onOpenOrganizer}
            >
              <FolderTree className="h-4 w-4" />
              {!sidebarCollapsed ? '漫画整理' : null}
            </button>

            <button
              className={cn(
                'flex w-full items-center rounded-lg py-2 text-sm font-semibold text-[#2f3b4c] hover:bg-[#e7ebf2]',
                sidebarCollapsed ? 'justify-center px-0' : 'justify-center gap-2 px-3'
              )}
              title="设置"
              onClick={onOpenSettings}
            >
              <Settings className="h-4 w-4" />
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
        onClose={() => setSourceManagerOpen(false)}
        onRemoveSource={onRemoveSource}
      />
    </>
  );
}
