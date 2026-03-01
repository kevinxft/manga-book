import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Clock3,
  FolderClosed,
  Folders,
  Heart,
  ImageOff,
  Search,
  Settings,
  SlidersHorizontal,
  RefreshCw,
  Import,
  Trash2,
  Loader2,
  Tag,
  X,
  Plus,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import type { MangaBookWithCover } from '@shared/types';
import { useLibraryStore } from '@renderer/stores/libraryStore';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import { cn } from '@renderer/lib/utils';

type SortKey = 'title' | 'addedAt' | 'lastReadAt';

type LibraryMenuItem = {
  key: string;
  label: string;
  icon: typeof Clock3;
};

const menuItems: LibraryMenuItem[] = [
  { key: 'recent', label: '最近添加', icon: Clock3 },
  { key: 'favorites', label: '收藏夹', icon: Heart },
  { key: 'folders', label: '文件夹', icon: FolderClosed },
  { key: 'all', label: '所有漫画', icon: Folders }
];

const TAG_COLOR_OPTIONS = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#6366f1',
  '#a855f7',
  '#ec4899',
  '#1e293b'
];
const DEFAULT_TAG_COLOR = '#ef4444';

type TagItem = {
  id: string;
  label: string;
  color: string;
};

type MangaPathCategory = 'artists' | 'series' | 'other';
type MangaCategoryFilter = 'all' | MangaPathCategory;

function toCoverSrc(filePath: string): string {
  return `manga-cover://local-image?path=${encodeURIComponent(filePath)}`;
}

function getMangaDisplayPath(folderPath: string, sourceFolderPath: string): string {
  const normalizePath = (value: string) => value.replace(/\\/g, '/').replace(/\/+$/, '');
  const source = normalizePath(sourceFolderPath);
  const target = normalizePath(folderPath);
  const sourceName = source.split('/').filter(Boolean).pop() ?? source;

  if (target === source) {
    return sourceName;
  }

  if (target.startsWith(`${source}/`)) {
    const relative = target.slice(source.length + 1);
    return `${sourceName}/${relative}`;
  }

  return target;
}

function normalizeDirectoryName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function hexToRgb(color: string): { r: number; g: number; b: number } | null {
  const normalized = color.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return null;
  }

  const value = Number.parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

function toRgba(color: string, alpha: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) {
    return color;
  }
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function getTagTextColor(color: string): string {
  const rgb = hexToRgb(color);
  if (!rgb) {
    return '#f8fafc';
  }
  const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return brightness > 168 ? '#162234' : '#f8fafc';
}

function getMangaPathCategory(folderPath: string, sourceFolderPath: string): MangaPathCategory {
  const normalizePath = (value: string) => value.replace(/\\/g, '/').replace(/\/+$/, '');
  const source = normalizePath(sourceFolderPath);
  const target = normalizePath(folderPath);
  const sourceBase = normalizeDirectoryName(source.split('/').filter(Boolean).pop() ?? '');

  if (sourceBase === 'artists' || sourceBase === 'artist') {
    return 'artists';
  }
  if (sourceBase === 'series') {
    return 'series';
  }

  if (!target.startsWith(`${source}/`)) {
    return 'other';
  }

  const relPath = target.slice(source.length + 1);
  const firstSegment = relPath.split('/').filter(Boolean)[0] ?? '';
  const firstKey = normalizeDirectoryName(firstSegment);

  if (firstKey === 'artists' || firstKey === 'artist') {
    return 'artists';
  }
  if (firstKey === 'series') {
    return 'series';
  }
  return 'other';
}

function getArtistNameFromMangaPath(folderPath: string): string | null {
  const segments = folderPath.replace(/\\/g, '/').split('/').filter(Boolean);
  if (segments.length < 3) {
    return null;
  }

  const artistsIndex = segments.findIndex((segment) => {
    const key = normalizeDirectoryName(segment);
    return key === 'artists' || key === 'artist';
  });

  if (artistsIndex < 0) {
    return null;
  }

  const artistIndex = artistsIndex + 1;
  const mangaIndex = artistsIndex + 2;
  if (artistIndex >= segments.length || mangaIndex >= segments.length) {
    return null;
  }

  return segments[artistIndex] ?? null;
}

interface LibraryPageProps {
  onOpenManga?: (manga: MangaBookWithCover) => void;
  onOpenSettings?: () => void;
}

export function LibraryPage({ onOpenManga, onOpenSettings }: LibraryPageProps) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('addedAt');
  const [activeMenu, setActiveMenu] = useState('all');
  const [tags, setTags] = useState<TagItem[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [draftTags, setDraftTags] = useState<TagItem[]>([]);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [newTagLabel, setNewTagLabel] = useState('');
  const [newTagColor, setNewTagColor] = useState<string>(DEFAULT_TAG_COLOR);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<MangaCategoryFilter>('all');
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);

  const {
    sources,
    mangas,
    loading,
    error,
    progress,
    fetchSources,
    fetchMangas,
    pickAndAddSources,
    removeSource,
    syncSources,
    refreshScanProgress
  } = useLibraryStore();
  const hasIpcBridge = typeof window !== 'undefined' && typeof window.mangaBookApi?.invoke === 'function';

  useEffect(() => {
    if (!hasIpcBridge) return;
    void fetchSources();
  }, [fetchSources, hasIpcBridge]);

  useEffect(() => {
    if (!hasIpcBridge) return;
    void fetchMangas({ query: search, sortBy });
  }, [fetchMangas, hasIpcBridge, search, sortBy]);

  useEffect(() => {
    if (!hasIpcBridge) return;
    const timer = setInterval(() => {
      void refreshScanProgress();
    }, 1200);

    return () => clearInterval(timer);
  }, [hasIpcBridge, refreshScanProgress]);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (filterMenuRef.current && !filterMenuRef.current.contains(target)) {
        setFilterMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, []);

  const scanRunning = progress.status === 'running';
  const scanPercent =
    progress.total > 0 ? Math.max(0, Math.min(100, Math.round((progress.current / progress.total) * 100))) : 0;
  const visibleMangas = useMemo(() => {
    if (categoryFilter === 'all') {
      return mangas;
    }
    return mangas.filter((manga) => getMangaPathCategory(manga.folderPath, manga.sourceFolderPath) === categoryFilter);
  }, [categoryFilter, mangas]);

  const openTagDialog = () => {
    setDraftTags(tags);
    setEditingTagId(null);
    setNewTagLabel('');
    setNewTagColor(DEFAULT_TAG_COLOR);
    setTagDialogOpen(true);
  };

  const handleUpsertTag = () => {
    const label = newTagLabel.trim();
    if (!label) return;
    const exists = draftTags.some(
      (tag) => tag.id !== editingTagId && tag.label.toLowerCase() === label.toLowerCase()
    );
    if (exists) return;
    if (editingTagId) {
      setDraftTags((prev) =>
        prev.map((tag) => (tag.id === editingTagId ? { ...tag, label, color: newTagColor } : tag))
      );
      setEditingTagId(null);
    } else {
      setDraftTags((prev) => [...prev, { id: crypto.randomUUID(), label, color: newTagColor }]);
    }
    setNewTagLabel('');
    setNewTagColor(DEFAULT_TAG_COLOR);
  };

  const handleRemoveDraftTag = (id: string) => {
    if (editingTagId === id) {
      setEditingTagId(null);
      setNewTagLabel('');
      setNewTagColor(DEFAULT_TAG_COLOR);
    }
    setDraftTags((prev) => prev.filter((tag) => tag.id !== id));
  };

  const handleStartEditTag = (tag: TagItem) => {
    setEditingTagId(tag.id);
    setNewTagLabel(tag.label);
    setNewTagColor(tag.color);
  };

  const handleCancelEditingTag = () => {
    setEditingTagId(null);
    setNewTagLabel('');
    setNewTagColor(DEFAULT_TAG_COLOR);
  };

  const handleSaveTags = () => {
    setTags(draftTags);
    setSelectedTags((prev) => prev.filter((id) => draftTags.some((tag) => tag.id === id)));
    setTagDialogOpen(false);
  };

  return (
    <main className="h-full w-full bg-[#eceef2] p-1">
      <div className="h-full overflow-hidden rounded-[8px] border border-[#d8dee9] bg-[#f1f2f5]">
        <div
          className={cn(
            'grid h-full overflow-hidden transition-[grid-template-columns] duration-200',
            sidebarCollapsed ? 'grid-cols-[72px_1fr]' : 'grid-cols-[270px_1fr]'
          )}
        >
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
                  onClick={() => setSidebarCollapsed(true)}
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
                        onClick={() => setActiveMenu(item.key)}
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
                      onClick={openTagDialog}
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
                            onClick={() => {
                              setSelectedTags((prev) =>
                                prev.includes(tag.id) ? prev.filter((id) => id !== tag.id) : [...prev, tag.id]
                              );
                            }}
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
                        <div key={source.id} className="rounded-lg border border-[#dbe2ee] bg-[#f9fbff] px-2.5 py-2" title={source.path}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold text-[#2b3950]">{source.displayName}</p>
                              <p className="mt-0.5 truncate text-[11px] text-[#7a879a]">{source.path}</p>
                              <p className="mt-1 text-[11px] font-semibold text-[#4f7bd8]">
                                {mangas.filter((manga) => manga.sourceFolderPath === source.path).length} 本漫画
                              </p>
                            </div>
                            <button
                              className="rounded-md p-1 text-[#7a879a] transition hover:bg-[#e8eef9] hover:text-[#d23b3b] disabled:opacity-50"
                              disabled={!hasIpcBridge}
                              onClick={() => {
                                if (!window.confirm(`确认移除目录？\\n${source.path}`)) return;
                                void removeSource(source.id);
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
                  onClick={() => setSidebarCollapsed(false)}
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
                onClick={() => void pickAndAddSources()}
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

          <section className="relative flex min-h-0 flex-col bg-[#f3f5f9]">
            <header className="flex h-16 items-center justify-between border-b border-[#dde2eb] bg-[#f1f3f6] px-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#4f5d73]">
                  <span>排序:</span>
                  <select
                    className="rounded-md border border-transparent bg-transparent px-1 py-1 text-sm outline-none hover:border-[#d0d7e3]"
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value as SortKey)}
                  >
                    <option value="addedAt">日期</option>
                    <option value="title">标题</option>
                    <option value="lastReadAt">最近阅读</option>
                  </select>
                </div>

                {loading ? <span className="text-xs font-semibold text-[#7b8799]">加载中...</span> : null}
              </div>

              <div className="flex items-center gap-1">
                <button
                  className="inline-flex h-10 items-center gap-1 rounded-lg border border-[#dce2ec] bg-[#eceff4] px-3 text-xs font-semibold text-[#5f6c80] hover:bg-[#e2e7f0] disabled:opacity-60"
                  onClick={() => void syncSources()}
                  disabled={!hasIpcBridge || scanRunning}
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', scanRunning && 'animate-spin')} />
                  重新扫描
                </button>
                <div className="relative w-[260px] max-w-[32vw]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a95a7]" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="h-10 rounded-lg border-[#dce2ec] bg-[#eceff4] pl-9 text-sm"
                    placeholder="搜索漫画、作者或标签..."
                  />
                </div>
                <div className="relative" ref={filterMenuRef}>
                  <button
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#dce2ec] bg-[#eceff4] text-[#5f6c80] hover:bg-[#e2e7f0]"
                    onClick={() => setFilterMenuOpen((prev) => !prev)}
                    title="筛选"
                  >
                    <SlidersHorizontal className="h-4 w-4 text-[#5e6c80]" />
                  </button>

                  {filterMenuOpen ? (
                    <div className="absolute right-0 top-11 z-30 w-40 rounded-lg border border-[#d6deea] bg-white p-1.5 shadow-[0_14px_28px_rgba(48,68,99,0.18)]">
                      {[
                        { key: 'all' as const, label: '全部' },
                        { key: 'artists' as const, label: 'Artists' },
                        { key: 'series' as const, label: 'Series' },
                        { key: 'other' as const, label: '未整理' }
                      ].map((item) => (
                        <button
                          key={item.key}
                          onClick={() => {
                            setCategoryFilter(item.key);
                            setFilterMenuOpen(false);
                          }}
                          className={cn(
                            'flex w-full items-center rounded-md px-2.5 py-2 text-left text-xs font-semibold transition',
                            categoryFilter === item.key
                              ? 'bg-[#e7efff] text-[#2f6cf6]'
                              : 'text-[#4f5d73] hover:bg-[#edf2f9]'
                          )}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </header>

            {!hasIpcBridge ? (
              <div className="mx-6 mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                当前运行在普通浏览器环境，IPC 不可用。请使用 <code>bun run dev</code> 启动 Electron 窗口。
              </div>
            ) : null}

            {scanRunning ? (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#1f2b3d]/18 backdrop-blur-[1px]">
                <div className="w-[320px] rounded-2xl border border-[#d9e2f2] bg-white px-5 py-4 shadow-[0_18px_42px_rgba(35,64,112,0.25)]">
                  <div className="mb-3 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-[#2f6cf6]" />
                    <p className="text-sm font-bold text-[#1f2b3d]">正在扫描漫画目录...</p>
                  </div>
                  <p className="truncate text-xs text-[#67758b]">{progress.message}</p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#dbe3f3]">
                    <div className="h-full rounded-full bg-[#2f6cf6] transition-all" style={{ width: `${scanPercent}%` }} />
                  </div>
                  <p className="mt-2 text-right text-xs font-semibold text-[#2f6cf6]">
                    {progress.total > 0 ? `${progress.current}/${progress.total}` : '--'} ({scanPercent}%)
                  </p>
                </div>
              </div>
            ) : null}

            {scanRunning ? (
              <div className="h-1 w-full bg-[#d6dff4]">
                <div
                  className="h-full bg-[#2f6cf6] transition-all"
                  style={{ width: `${progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}%` }}
                />
              </div>
            ) : null}

            {error ? (
              <div className="mx-6 mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))] gap-x-5 gap-y-8">
                {visibleMangas.map((manga) => {
                  const artistName = getArtistNameFromMangaPath(manga.folderPath);
                  const fullDisplayPath = getMangaDisplayPath(manga.folderPath, manga.sourceFolderPath);

                  return (
                    <article
                      key={manga.id}
                      title={fullDisplayPath}
                      className="group"
                    >
                      <button
                        className="relative block w-full cursor-pointer overflow-hidden rounded-2xl border-0 bg-[#d8dde6] p-0 text-left shadow-[0_10px_24px_rgba(53,71,95,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6cf6]/40"
                        onClick={() => onOpenManga?.(manga)}
                        title={`打开：${manga.title}`}
                      >
                        <div className="aspect-[3/4]">
                          {manga.coverPath ? (
                            <img
                              src={toCoverSrc(manga.coverPath)}
                              alt={manga.title}
                              loading="lazy"
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center bg-[#dce2ec] text-[#8a96a8]">
                              <ImageOff className="h-10 w-10" />
                            </div>
                          )}
                        </div>
                        {artistName ? (
                          <span className="absolute left-2 top-2 max-w-[85%] truncate rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">
                            {artistName}
                          </span>
                        ) : null}
                        <span className="absolute bottom-2 left-2 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">
                          {manga.totalPages} 页
                        </span>
                      </button>

                      <div className="mt-2">
                        <p className="truncate text-xs font-semibold leading-tight text-[#1f2b3d]" title={fullDisplayPath}>
                          {manga.title}
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>
              {!loading && visibleMangas.length === 0 ? (
                <div className="mt-8 rounded-xl border border-dashed border-[#cfd7e4] bg-[#f7f9fc] px-6 py-10 text-center">
                  <p className="text-sm font-semibold text-[#46546a]">
                    {mangas.length === 0 ? '当前没有漫画数据' : '当前筛选下没有漫画'}
                  </p>
                  <p className="mt-2 text-xs text-[#7d889c]">
                    {mangas.length === 0 ? '点击左下角“导入目录”添加来源后会自动显示。' : '切换到“全部”或调整筛选条件。'}
                  </p>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>

      {tagDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#7f8899]/65 px-4 py-8">
          <div className="w-full max-w-[780px] overflow-hidden rounded-2xl border border-[#d7dde8] bg-[#f4f6fa] shadow-[0_24px_72px_rgba(39,53,73,0.35)]">
            <div className="flex items-center justify-between border-b border-[#dde3ee] px-6 py-4">
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#deebff]">
                  <Tag className="h-5 w-5 text-[#2f6cf6]" />
                </div>
                <h2 className="text-xl font-bold leading-none text-[#111b2d]">管理标签</h2>
              </div>
              <button
                className="rounded-md p-1.5 text-[#7a869b] transition hover:bg-[#e8edf5] hover:text-[#4d5d75]"
                onClick={() => setTagDialogOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6 px-6 py-5">
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-base font-extrabold tracking-wide text-[#1d2739]">当前标签</p>
                  <p className="text-sm font-semibold text-[#70829d]">共 {draftTags.length} 个标签</p>
                </div>

                {draftTags.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#cfd8e6] bg-white/70 px-4 py-6 text-center text-xs text-[#7f8ea5]">
                    暂无标签
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2.5">
                    {draftTags.map((tag) => (
                      <div
                        key={tag.id}
                        className="flex items-center gap-1.5 rounded-lg border px-1.5 py-1"
                        style={{
                          backgroundColor: toRgba(tag.color, 0.12),
                          borderColor: toRgba(tag.color, 0.35)
                        }}
                      >
                        <button
                          className="min-w-0 rounded-md px-2.5 py-1 text-xs font-semibold transition hover:opacity-90"
                          style={{
                            backgroundColor: tag.color,
                            color: getTagTextColor(tag.color)
                          }}
                          onClick={() => handleStartEditTag(tag)}
                          title="点击编辑标签"
                        >
                          <span className="truncate">{tag.label}</span>
                        </button>
                        <button
                          className="rounded-md p-1 text-[#98a7bc] hover:bg-[#f2f6fb] hover:text-[#50617a]"
                          onClick={() => handleRemoveDraftTag(tag.id)}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <div className="h-px bg-[#dde3ee]" />

              <section>
                <p className="mb-4 text-base font-extrabold tracking-wide text-[#1d2739]">
                  {editingTagId ? '编辑标签' : '新增标签'}
                </p>

                <div className="space-y-2">
                  <label className="text-xs font-bold tracking-wide text-[#6d7f99]">标签名称</label>
                  <Input
                    value={newTagLabel}
                    onChange={(event) => setNewTagLabel(event.target.value)}
                    placeholder="例如：日常 / 热血 / 悬疑"
                    className="h-10 rounded-xl border-[#d7deea] bg-white text-sm placeholder:text-[#a3afc2]"
                  />
                </div>

                <div className="mt-4 space-y-2.5">
                  <label className="text-xs font-bold tracking-wide text-[#6d7f99]">标签颜色</label>
                  <div className="flex flex-wrap items-center gap-2.5">
                    {TAG_COLOR_OPTIONS.map((color) => {
                      const active = color === newTagColor;
                      return (
                        <button
                          key={color}
                          onClick={() => setNewTagColor(color)}
                          className={cn(
                            'h-9 w-9 rounded-full border-2 transition',
                            active ? 'border-[#2f6cf6] ring-2 ring-[#c8dcff]' : 'border-transparent'
                          )}
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      );
                    })}
                  </div>
                </div>

                <button
                  className="mt-5 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#dfeaf9] text-base font-bold text-[#2f6cf6] transition hover:bg-[#d3e2f8]"
                  onClick={handleUpsertTag}
                >
                  <Plus className="h-5 w-5" />
                  {editingTagId ? '保存标签' : '新建标签'}
                </button>

                {editingTagId ? (
                  <button
                    className="mt-2 flex h-9 w-full items-center justify-center rounded-xl text-xs font-semibold text-[#667891] transition hover:bg-[#e9eef7]"
                    onClick={handleCancelEditingTag}
                  >
                    取消编辑
                  </button>
                ) : null}
              </section>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#dde3ee] px-6 py-4">
              <button
                className="rounded-lg px-4 py-2 text-base font-bold text-[#4a5a72] transition hover:bg-[#e9eef7]"
                onClick={() => setTagDialogOpen(false)}
              >
                取消
              </button>
              <button
                className="rounded-lg bg-[#2f7fe6] px-5 py-2 text-base font-bold text-white shadow-[0_10px_24px_rgba(47,127,230,0.35)] transition hover:bg-[#236ecc]"
                onClick={handleSaveTags}
              >
                保存修改
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
