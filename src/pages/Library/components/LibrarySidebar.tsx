import {
  BookOpen,
  Clock3,
  FolderClosed,
  Folders,
  Heart,
  Import,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Trash2
} from 'lucide-react';
import type { LibraryFolder } from '@shared/types';
import { Button } from '@renderer/components/ui/button';
import { cn } from '@renderer/lib/utils';
import type { LibraryMenuItem, TagItem } from '../types';
import { getTagTextColor, toRgba } from '../utils';

const menuItems: LibraryMenuItem[] = [
  { key: 'recent', label: '最近添加', icon: Clock3 },
  { key: 'favorites', label: '收藏夹', icon: Heart },
  { key: 'folders', label: '文件夹', icon: FolderClosed },
  { key: 'all', label: '所有漫画', icon: Folders }
];

interface LibrarySidebarProps {
  sidebarCollapsed: boolean;
  activeMenu: string;
  tags: TagItem[];
  selectedTags: string[];
  sources: LibraryFolder[];
  sourceMangaCountByPath: Record<string, number>;
  hasIpcBridge: boolean;
  onActiveMenuChange: (value: string) => void;
  onSidebarCollapsedChange: (value: boolean) => void;
  onToggleTag: (id: string) => void;
  onOpenTagDialog: () => void;
  onPickAndAddSources: () => void;
  onRemoveSource: (sourceId: string) => void;
  onOpenSettings?: () => void;
}

export function LibrarySidebar({
  sidebarCollapsed,
  activeMenu,
  tags,
  selectedTags,
  sources,
  sourceMangaCountByPath,
  hasIpcBridge,
  onActiveMenuChange,
  onSidebarCollapsedChange,
  onToggleTag,
  onOpenTagDialog,
  onPickAndAddSources,
  onRemoveSource,
  onOpenSettings
}: LibrarySidebarProps) {
  return (
    <aside className="flex h-full flex-col border-r border-[#dce1ea] bg-[#f6f7f9]">
      <div
        className={cn(
          'flex items-start border-b border-[#e2e6ee]',
          sidebarCollapsed ? 'justify-center px-2 py-4' : 'justify-between px-4 py-4'
        )}
      >
        <div className={cn('flex items-start', sidebarCollapsed ? 'justify-center' : 'gap-2')}>
          <BookOpen className="mt-0.5 h-6 w-6 text-[#2563eb]" />
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

      <div className={cn('space-y-5 px-4', sidebarCollapsed && 'px-2')}>
        <section>
          {!sidebarCollapsed ? <p className="mb-3 px-2 text-xs font-semibold text-[#8893a4]">常规</p> : null}
          <div className="space-y-1.5">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = item.key === activeMenu;
              return (
                <button
                  key={item.key}
                  onClick={() => onActiveMenuChange(item.key)}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={cn(
                    'flex w-full items-center rounded-lg py-2 text-sm font-semibold transition',
                    sidebarCollapsed ? 'justify-center px-0' : 'gap-2 px-3',
                    active
                      ? 'bg-[#2f6cf6] text-white shadow-[0_6px_18px_rgba(47,108,246,0.25)]'
                      : 'text-[#2f3b4c] hover:bg-[#e7ebf2]'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {!sidebarCollapsed ? item.label : null}
                </button>
              );
            })}
          </div>
        </section>

        {!sidebarCollapsed ? (
          <section>
            <div className="mb-3 flex items-center justify-between px-2">
              <p className="text-xs font-semibold text-[#8893a4]">标签过滤</p>
              <button
                className="rounded-md px-2 py-1 text-[11px] font-semibold text-[#2f6cf6] hover:bg-[#e7efff]"
                onClick={onOpenTagDialog}
              >
                管理
              </button>
            </div>
            {tags.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#d4dbe7] bg-[#f8fafd] px-3 py-2 text-xs text-[#8c97aa]">
                暂无标签数据
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {tags.map((tag) => {
                  const active = selectedTags.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      onClick={() => onToggleTag(tag.id)}
                      className="flex items-center justify-center rounded-md border px-2 py-1.5 text-xs font-semibold transition"
                      style={{
                        backgroundColor: active ? tag.color : toRgba(tag.color, 0.8),
                        borderColor: active ? toRgba(tag.color, 0.95) : toRgba(tag.color, 0.6),
                        color: getTagTextColor(tag.color),
                        opacity: active ? 1 : 0.82
                      }}
                    >
                      <span className="truncate">{tag.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}

        {!sidebarCollapsed ? (
          <section>
            <p className="mb-3 px-2 text-xs font-semibold text-[#8893a4]">已导入目录 ({sources.length})</p>
            <div className="max-h-[180px] space-y-2 overflow-auto pr-1">
              {sources.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#d4dbe7] bg-[#f8fafd] px-3 py-2 text-xs text-[#8c97aa]">
                  暂无已导入目录
                </div>
              ) : (
                sources.map((source) => (
                  <div
                    key={source.id}
                    className="rounded-lg border border-[#dbe2ee] bg-[#f9fbff] px-2.5 py-2"
                    title={source.path}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-[#2b3950]">{source.displayName}</p>
                        <p className="mt-0.5 truncate text-[11px] text-[#7a879a]">{source.path}</p>
                        <p className="mt-1 text-[11px] font-semibold text-[#4f7bd8]">
                          {sourceMangaCountByPath[source.path] ?? 0} 本漫画
                        </p>
                      </div>
                      <button
                        className="rounded-md p-1 text-[#7a879a] transition hover:bg-[#e8eef9] hover:text-[#d23b3b] disabled:opacity-50"
                        disabled={!hasIpcBridge}
                        onClick={() => {
                          if (!window.confirm(`确认移除目录？\\n${source.path}`)) return;
                          onRemoveSource(source.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        ) : null}
      </div>

      <div className={cn('mt-auto space-y-3 border-t border-[#dce1ea] p-4', sidebarCollapsed && 'px-2')}>
        {sidebarCollapsed ? (
          <button
            className="flex w-full items-center justify-center rounded-lg border border-[#d7deea] bg-white py-2 text-[#5a6880] transition hover:bg-[#e7ebf2]"
            onClick={() => onSidebarCollapsedChange(false)}
            title="展开侧栏"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        ) : null}
        <Button
          className={cn(
            'h-11 w-full rounded-lg bg-[#2f6cf6] text-sm font-semibold text-white hover:bg-[#255de0]',
            sidebarCollapsed && 'h-10 px-0'
          )}
          onClick={onPickAndAddSources}
          disabled={!hasIpcBridge}
          title="导入目录"
        >
          <Import className={cn('h-4 w-4', !sidebarCollapsed && 'mr-2')} />
          {!sidebarCollapsed ? '导入目录' : null}
        </Button>

        <button
          className={cn(
            'flex w-full items-center rounded-lg py-2 text-sm font-semibold text-[#2f3b4c] hover:bg-[#e7ebf2]',
            sidebarCollapsed ? 'justify-center px-0' : 'gap-2 px-3'
          )}
          title="设置"
          onClick={onOpenSettings}
        >
          <Settings className="h-4 w-4" />
          {!sidebarCollapsed ? '设置' : null}
        </button>
      </div>
    </aside>
  );
}
