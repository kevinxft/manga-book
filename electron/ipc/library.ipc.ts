import path from 'node:path';
import { dialog } from 'electron';
import type { IpcContext } from './context';
import { registerHandler, ok, fail } from './helpers';
import { directoryExists, listDirectories } from '@main/utils/fsUtils';
import { normalizeAbsolutePath, pathToDisplayName } from '@main/utils/pathUtils';
import { clearCoverPathCache, resolveCoverPath } from '@main/scanner/coverFinder';
import type { LibraryFolder } from '@shared/types';

type AddSourceSkipReason = 'DUPLICATE' | 'NOT_FOUND' | 'INVALID' | 'ORGANIZER_ROOT_CONFLICT';

function normalizeDirectoryName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function registerLibraryIpc(context: IpcContext): void {
  const { repositories, scanner, scanQueue } = context;
  const { library, manga, tag } = repositories;

  const isOrganizerRootDirectory = async (candidatePath: string): Promise<boolean> => {
    try {
      const childDirectoryNames = (await listDirectories(candidatePath)).map((directoryPath) =>
        normalizeDirectoryName(path.basename(directoryPath))
      );
      const hasArtists = childDirectoryNames.includes('artists') || childDirectoryNames.includes('artist');
      return hasArtists && childDirectoryNames.includes('inbox');
    } catch {
      return false;
    }
  };

  const findExistingOrganizerRoot = async (): Promise<string | null> => {
    const sources = library.list();
    for (const source of sources) {
      if (await isOrganizerRootDirectory(source.path)) {
        return source.path;
      }
    }
    return null;
  };

  const addSourcesInternal = async (rawPaths: string[]) => {
    const existingPaths = new Set(library.list().map((source) => source.path));
    const added: LibraryFolder[] = [];
    const skipped: Array<{ path: string; reason: AddSourceSkipReason }> = [];
    const acceptedScanPaths: string[] = [];
    let organizerRootPath = await findExistingOrganizerRoot();

    for (const rawPath of rawPaths) {
      if (!rawPath?.trim()) {
        skipped.push({ path: rawPath ?? '', reason: 'INVALID' });
        continue;
      }

      const normalizedPath = normalizeAbsolutePath(rawPath);
      if (existingPaths.has(normalizedPath)) {
        skipped.push({ path: normalizedPath, reason: 'DUPLICATE' });
        continue;
      }

      const exists = await directoryExists(normalizedPath);
      if (!exists) {
        skipped.push({ path: normalizedPath, reason: 'NOT_FOUND' });
        continue;
      }

      const isOrganizerRoot = await isOrganizerRootDirectory(normalizedPath);
      if (isOrganizerRoot && organizerRootPath && organizerRootPath !== normalizedPath) {
        skipped.push({ path: normalizedPath, reason: 'ORGANIZER_ROOT_CONFLICT' });
        continue;
      }

      const source = library.add(normalizedPath, pathToDisplayName(normalizedPath));
      existingPaths.add(normalizedPath);
      acceptedScanPaths.push(normalizedPath);
      added.push(source);
      if (isOrganizerRoot) {
        organizerRootPath = normalizedPath;
      }
    }

    const taskId =
      acceptedScanPaths.length > 0
        ? scanQueue.enqueue({
            name: `Scan ${acceptedScanPaths.length} source(s)`,
            run: async (signal, reportProgress) => {
              clearCoverPathCache();
              await scanner.syncSources(acceptedScanPaths, reportProgress, signal);
            }
          })
        : null;

    return { added, skipped, taskId };
  };

  registerHandler('library.pickSourceDirectories', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择漫画来源目录',
      properties: ['openDirectory', 'multiSelections', 'dontAddToRecent']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return ok({ paths: [] });
    }

    const paths = result.filePaths.map((filePath) => normalizeAbsolutePath(filePath));
    return ok({ paths });
  });

  registerHandler('library.addSources', async (request) => {
    const paths = request?.paths ?? [];
    if (paths.length === 0) {
      return fail('VALIDATION', 'At least one source path is required');
    }

    const result = await addSourcesInternal(paths);
    return ok(result);
  });

  registerHandler('library.addSource', async (request) => {
    const rawPath = request?.path;
    if (!rawPath?.trim()) {
      return fail('VALIDATION', 'Source path is required');
    }

    const result = await addSourcesInternal([rawPath]);
    if (result.added.length > 0) {
      return ok(result.added[0] as LibraryFolder);
    }

    const firstSkip = result.skipped[0];
    const message =
      firstSkip?.reason === 'DUPLICATE'
        ? 'Source already exists'
        : firstSkip?.reason === 'NOT_FOUND'
          ? `Directory does not exist: ${firstSkip.path}`
          : firstSkip?.reason === 'ORGANIZER_ROOT_CONFLICT'
            ? 'Only one organizer root is allowed (must contain Artists + Inbox).'
          : 'Invalid source path';

    return fail('ADD_SOURCE_FAILED', message);
  });

  registerHandler('library.removeSource', async (request) => {
    const source = library.getById(request.id);
    if (!source) {
      return fail('NOT_FOUND', 'Source not found');
    }

    const removed = library.remove(request.id);
    if (removed) {
      manga.deleteBySource(source.path);
    }

    return ok({ removed });
  });

  registerHandler('library.listSources', () => ok(library.list()));

  registerHandler('library.syncSources', async (request) => {
    const paths = request?.paths?.length ? request.paths : library.list().map((item) => item.path);
    const forceRescan = request?.forceRescan ?? true;

    if (paths.length === 0) {
      return fail('NO_SOURCES', '请先添加至少一个漫画来源目录。');
    }

    const taskId = scanQueue.enqueue({
      name: 'Library sync',
      run: async (signal, reportProgress) => {
        if (forceRescan) {
          clearCoverPathCache();
        }
        await scanner.syncSources(paths, reportProgress, signal);
      }
    });

    return ok({ taskId });
  });

  registerHandler('library.listMangas', async (request) => {
    const filter = request ?? undefined;
    const books = manga.list(filter);
    const booksWithCover = await Promise.all(
      books.map(async (book) => {
        const coverPath = await resolveCoverPath(book.folderPath);
        const tags = tag.listByManga(book.id);
        return { ...book, coverPath, tags };
      })
    );

    return ok(booksWithCover);
  });

  registerHandler('library.getScanProgress', () => {
    const activeTask = scanQueue.getActiveTask();

    if (!activeTask) {
      return ok({
        taskId: null,
        status: 'idle' as const,
        current: 0,
        total: 0,
        message: 'Idle'
      });
    }

    return ok({
      taskId: activeTask.id,
      status: 'running' as const,
      current: activeTask.progress.current,
      total: activeTask.progress.total,
      message: activeTask.progress.message
    });
  });

  registerHandler('library.getScanTaskStatus', (request) => {
    const task = scanQueue.getTask(request.taskId);
    if (!task) {
      return fail('NOT_FOUND', 'Scan task not found');
    }

    return ok({
      taskId: task.id,
      status: task.status,
      current: task.progress.current,
      total: task.progress.total,
      message: task.progress.message,
      error: task.error
    });
  });
}
