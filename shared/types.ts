export type MangaStructure = 'singleVolume' | 'multiVolume';

export interface MangaBook {
  id: string;
  title: string;
  folderPath: string;
  sourceFolderPath: string;
  structure: MangaStructure;
  addedAt: string;
  lastReadAt: string | null;
  isFavorite: 0 | 1;
  lastChapterIndex: number;
  lastPageIndex: number;
  totalPages: number;
}

export interface MangaBookWithCover extends MangaBook {
  coverPath: string | null;
  tags: MangaTag[];
}

export interface LibraryFolder {
  id: string;
  path: string;
  displayName: string;
  addedAt: string;
}

export interface MangaTag {
  id: string;
  name: string;
  createdAt: string;
}

export interface MangaBookTag {
  mangaId: string;
  tagId: string;
  createdAt: string;
}

export interface Bookmark {
  id: string;
  mangaId: string;
  chapterIndex: number;
  pageIndex: number;
  chapterName: string;
  title: string;
  note: string;
  createdAt: string;
}

export interface DirectoryAlias {
  id: string;
  alias: string;
  canonicalName: string;
  createdAt: string;
}

export interface TargetDirectorySummary {
  directory: string;
  mangaCount: number;
  lastMovedAt: string | null;
}

export interface MangaFilter {
  query?: string;
  sourceFolderPaths?: string[];
  sortBy?: 'addedAtDesc' | 'addedAtAsc' | 'titleAsc' | 'titleDesc' | 'lastReadAtDesc';
}

export interface ScanProgress {
  taskId: string | null;
  status: 'idle' | 'running';
  current: number;
  total: number;
  message: string;
}

export interface IpcError {
  code: string;
  message: string;
}

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: IpcError };

export interface LibraryAddSourceRequest {
  path: string;
}

export interface LibraryAddSourcesRequest {
  paths: string[];
}

export interface LibraryAddSourcesResult {
  added: LibraryFolder[];
  skipped: Array<{
    path: string;
    reason: 'DUPLICATE' | 'NOT_FOUND' | 'INVALID' | 'ORGANIZER_ROOT_CONFLICT';
  }>;
  taskId: string | null;
}

export interface LibraryRemoveSourceRequest {
  id: string;
}

export interface LibrarySyncSourcesRequest {
  paths?: string[];
  forceRescan?: boolean;
}

export interface ReaderSaveProgressRequest {
  mangaId: string;
  chapterIndex: number;
  pageIndex: number;
  totalPages: number;
}

export interface ReaderListPagesRequest {
  mangaId: string;
}

export interface BookmarkCreateRequest {
  mangaId: string;
  chapterIndex: number;
  pageIndex: number;
  title?: string;
  note?: string;
}

export interface BookmarkUpdateRequest {
  id: string;
  title: string;
  note: string;
}

export interface OrganizerMoveMangaRequest {
  mangaId: string;
  destinationPath: string;
}

export interface OrganizerMoveMangaResult {
  manga: MangaBook;
  renamedDueToConflict: boolean;
}

export interface OrganizerOpenMangaFolderRequest {
  mangaId: string;
}

export interface OrganizerRenameMangaRequest {
  mangaId: string;
  newTitle: string;
}

export interface OrganizerAddAliasRequest {
  alias: string;
  canonicalName: string;
  canonicalPath?: string;
}

export interface OrganizerRemoveAliasRequest {
  alias: string;
  canonicalPath?: string;
}

export interface OrganizerCreateAuthorDirectoryRequest {
  name: string;
  basePath?: string;
}

export interface OrganizerDeleteMangaRequest {
  mangaId: string;
  withFiles: boolean;
}

export interface OrganizerSearchGoogleRequest {
  query: string;
}

export interface OrganizerSearchWebRequest {
  provider: 'hitomi' | 'exhentai' | 'google';
  query: string;
}

export interface TagAddToMangaRequest {
  mangaId: string;
  tagName: string;
}

export interface TagAddToMangaResult {
  tag: MangaTag;
  linked: boolean;
}

export interface TagUpsertRequest {
  name: string;
}

export interface TagDeleteRequest {
  id: string;
}

export interface TagSetForMangaRequest {
  mangaId: string;
  tagNames: string[];
}

export interface TagRemoveFromMangaRequest {
  mangaId: string;
  tagName: string;
}

export interface TagClearAllResult {
  deleted: number;
}

export interface IpcChannels {
  'library.addSource': { req: LibraryAddSourceRequest; res: LibraryFolder };
  'library.addSources': { req: LibraryAddSourcesRequest; res: LibraryAddSourcesResult };
  'library.pickSourceDirectories': { req: void; res: { paths: string[] } };
  'library.removeSource': { req: LibraryRemoveSourceRequest; res: { removed: boolean } };
  'library.listSources': { req: void; res: LibraryFolder[] };
  'library.syncSources': { req: LibrarySyncSourcesRequest | void; res: { taskId: string } };
  'library.listMangas': { req: MangaFilter | void; res: MangaBookWithCover[] };
  'library.getScanProgress': { req: void; res: ScanProgress };

  'organizer.moveManga': { req: OrganizerMoveMangaRequest; res: OrganizerMoveMangaResult };
  'organizer.openMangaFolder': { req: OrganizerOpenMangaFolderRequest; res: { opened: boolean } };
  'organizer.renameManga': { req: OrganizerRenameMangaRequest; res: MangaBook };
  'organizer.addAlias': { req: OrganizerAddAliasRequest; res: DirectoryAlias };
  'organizer.listAliases': { req: void; res: DirectoryAlias[] };
  'organizer.removeAlias': { req: OrganizerRemoveAliasRequest; res: { removed: boolean } };
  'organizer.listAuthorDirectories': { req: void; res: TargetDirectorySummary[] };
  'organizer.createAuthorDirectory': { req: OrganizerCreateAuthorDirectoryRequest; res: { path: string; created: boolean } };
  'organizer.deleteManga': { req: OrganizerDeleteMangaRequest; res: { deleted: boolean } };
  'organizer.searchGoogle': { req: OrganizerSearchGoogleRequest; res: { opened: boolean } };
  'organizer.searchWeb': { req: OrganizerSearchWebRequest; res: { opened: boolean } };

  'tag.list': { req: void; res: MangaTag[] };
  'tag.upsert': { req: TagUpsertRequest; res: MangaTag };
  'tag.delete': { req: TagDeleteRequest; res: { deleted: boolean } };
  'tag.addToManga': { req: TagAddToMangaRequest; res: TagAddToMangaResult };
  'tag.setForManga': { req: TagSetForMangaRequest; res: MangaTag[] };
  'tag.removeFromManga': { req: TagRemoveFromMangaRequest; res: { removed: boolean } };
  'tag.clearAll': { req: void; res: TagClearAllResult };

  'reader.listPages': { req: ReaderListPagesRequest; res: string[] };
  'reader.saveProgress': { req: ReaderSaveProgressRequest; res: { saved: boolean } };

  'bookmark.create': { req: BookmarkCreateRequest; res: Bookmark };
  'bookmark.update': { req: BookmarkUpdateRequest; res: Bookmark };
  'bookmark.delete': { req: { id: string }; res: { deleted: boolean } };
  'bookmark.listByManga': { req: { mangaId: string }; res: Bookmark[] };
}
