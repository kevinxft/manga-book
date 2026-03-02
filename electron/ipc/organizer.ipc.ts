import fs from 'node:fs/promises';
import path from 'node:path';
import { BrowserWindow, Menu, ipcMain, shell } from 'electron';
import trash from 'trash';
import type { MangaBook } from '@shared/types';
import type { IpcContext } from './context';
import { registerHandler, ok, fail } from './helpers';
import { ensureDirectory, movePath } from '@main/utils/fsUtils';
import { normalizeAbsolutePath } from '@main/utils/pathUtils';
import { invalidateCoverPath } from '@main/scanner/coverFinder';

type OrganizerKind = 'artists' | 'series' | 'other';

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+$/, '');
}

function normalizeDirectoryName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getMangaKind(folderPath: string, sourceFolderPath: string): OrganizerKind {
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

function toAuthorKind(kind: OrganizerKind): OrganizerKind {
  if (kind === 'series') {
    return 'artists';
  }
  return kind;
}

function getCategoryLocation(book: MangaBook, kind: OrganizerKind): { label: string; path: string } | null {
  if (kind === 'other') {
    return null;
  }

  const targetSegments = normalizePath(book.folderPath).split('/').filter(Boolean);
  const marker = kind === 'artists' ? ['artists', 'artist'] : ['series'];
  const markerIndex = targetSegments.findIndex((segment) => marker.includes(normalizeDirectoryName(segment)));

  if (markerIndex >= 0 && markerIndex + 1 < targetSegments.length) {
    return {
      label: targetSegments[markerIndex + 1] ?? '未命名目录',
      path: `${book.folderPath.startsWith('/') ? '/' : ''}${targetSegments.slice(0, markerIndex + 2).join('/')}`
    };
  }

  if (targetSegments.length >= 2) {
    return {
      label: targetSegments[targetSegments.length - 2] ?? '未命名目录',
      path: `${book.folderPath.startsWith('/') ? '/' : ''}${targetSegments.slice(0, -1).join('/')}`
    };
  }

  return null;
}

function buildQuickMoveTargets(
  books: MangaBook[],
  resolveAlias: (name: string) => string
): Array<{ kind: OrganizerKind; label: string; path: string }> {
  const bucket = new Map<string, { kind: OrganizerKind; label: string; path: string; count: number }>();

  for (const item of books) {
    const sourceKind = getMangaKind(item.folderPath, item.sourceFolderPath);
    const kind = toAuthorKind(sourceKind);
    const location = getCategoryLocation(item, sourceKind);
    if (!location) {
      continue;
    }

    const canonicalLabel = resolveAlias(location.label);
    const canonicalPath = path.join(path.dirname(location.path), canonicalLabel);
    const key = `${kind}:${normalizePath(canonicalPath)}`;
    const found = bucket.get(key);
    if (found) {
      found.count += 1;
      continue;
    }

    bucket.set(key, { kind, label: canonicalLabel, path: canonicalPath, count: 1 });
  }

  return [...bucket.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'zh-Hans-CN'))
    .map((item) => ({ kind: item.kind, label: item.label, path: item.path }));
}

export function registerOrganizerIpc(context: IpcContext): void {
  const { manga, alias } = context.repositories;

  registerHandler('organizer.moveManga', async (request) => {
    const book = manga.getById(request.mangaId);
    if (!book) {
      return fail('NOT_FOUND', 'Manga not found');
    }

    const destinationRoot = normalizeAbsolutePath(request.destinationPath);
    await ensureDirectory(destinationRoot);

    const nextFolderPath = path.join(destinationRoot, path.basename(book.folderPath));
    await movePath(book.folderPath, nextFolderPath);

    invalidateCoverPath(book.folderPath);
    const updated = manga.updatePath(book.id, path.basename(nextFolderPath), nextFolderPath);

    return ok(updated);
  });

  registerHandler('organizer.renameManga', async (request) => {
    const book = manga.getById(request.mangaId);
    if (!book) {
      return fail('NOT_FOUND', 'Manga not found');
    }

    const parentDirectory = path.dirname(book.folderPath);
    const nextFolderPath = path.join(parentDirectory, request.newTitle);

    await movePath(book.folderPath, nextFolderPath);

    invalidateCoverPath(book.folderPath);
    const updated = manga.updatePath(book.id, request.newTitle, nextFolderPath);

    return ok(updated);
  });

  registerHandler('organizer.addAlias', async (request) => {
    const inputAlias = request.alias?.trim();
    const canonicalName = request.canonicalName?.trim();

    if (!inputAlias || !canonicalName) {
      return fail('VALIDATION', 'Alias and canonical name are required');
    }

    const stored = alias.insert(inputAlias, canonicalName);
    return ok(stored);
  });

  registerHandler('organizer.deleteManga', async (request) => {
    const book = manga.getById(request.mangaId);
    if (!book) {
      return fail('NOT_FOUND', 'Manga not found');
    }

    if (request.withFiles) {
      await trash([book.folderPath]);
    } else {
      await fs.access(book.folderPath);
    }

    invalidateCoverPath(book.folderPath);
    const deleted = manga.deleteById(book.id);

    return ok({ deleted });
  });

  ipcMain.handle('organizer.showMangaContextMenu', async (event, request) => {
    try {
      const senderWindow = BrowserWindow.fromWebContents(event.sender);
      if (!senderWindow) {
        return fail('WINDOW_NOT_FOUND', 'No active window found');
      }

      const book = manga.getById(request.mangaId);
      if (!book) {
        return fail('NOT_FOUND', 'Manga not found');
      }

      const quickMoveTargets = buildQuickMoveTargets(manga.list(), (name) => alias.resolve(name));
      const currentParent = normalizePath(path.dirname(book.folderPath));
      const moveTargets = quickMoveTargets.filter((target) => normalizePath(target.path) !== currentParent);

      const buildMoveSubMenu = (targets: Array<{ kind: OrganizerKind; label: string; path: string }>) => {
        if (targets.length === 0) {
          return [{ label: '暂无可用目录', enabled: false }];
        }

        return targets.map((target) => ({
          label: target.label,
          click: () => {
            void (async () => {
              try {
                const destinationRoot = normalizeAbsolutePath(target.path);
                await ensureDirectory(destinationRoot);
                const nextFolderPath = path.join(destinationRoot, path.basename(book.folderPath));
                await movePath(book.folderPath, nextFolderPath);
                invalidateCoverPath(book.folderPath);
                manga.updatePath(book.id, path.basename(nextFolderPath), nextFolderPath);
                event.sender.send('organizer.context-menu-action', { type: 'moved', mangaId: book.id });
              } catch (error) {
                event.sender.send('organizer.context-menu-action', {
                  type: 'error',
                  mangaId: book.id,
                  message: error instanceof Error ? error.message : '快速移动失败'
                });
              }
            })();
          }
        }));
      };

      const menu = Menu.buildFromTemplate([
        {
          label: '快速移动到作者',
          submenu: buildMoveSubMenu(moveTargets)
        },
        {
          label: '重命名',
          click: () => {
            event.sender.send('organizer.context-menu-action', {
              type: 'requestRename',
              mangaId: book.id,
              currentTitle: book.title
            });
          }
        },
        {
          label: '在文件夹中打开',
          click: () => {
            void shell.openPath(book.folderPath);
            event.sender.send('organizer.context-menu-action', {
              type: 'openedInFolder',
              mangaId: book.id
            });
          }
        }
      ]);

      menu.popup({
        window: senderWindow,
        x: typeof request.x === 'number' ? request.x : undefined,
        y: typeof request.y === 'number' ? request.y : undefined
      });

      return ok({ shown: true });
    } catch (error) {
      return fail('UNEXPECTED', error instanceof Error ? error.message : 'Failed to show context menu');
    }
  });
}
