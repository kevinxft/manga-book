import { dialog, shell } from 'electron';
import type { IpcContext } from './context';
import { registerHandler, ok, fail } from './helpers';
import { directoryExists } from '@main/utils/fsUtils';
import { normalizeAbsolutePath, pathToDisplayName } from '@main/utils/pathUtils';
import { clearCoverPathCache, resolveCoverPath } from '@main/scanner/coverFinder';
import type { LibraryFolder } from '@shared/types';
import { detectAuthorRootDirectory, findAuthorRootSources } from './organizer.common';

type AddSourceSkipReason = 'DUPLICATE' | 'NOT_FOUND' | 'INVALID' | 'ORGANIZER_ROOT_CONFLICT';

function formatAuthorRootConflictMessage(paths: string[]): string {
  const uniquePaths = Array.from(new Set(paths.map((item) => normalizeAbsolutePath(item))));
  if (uniquePaths.length === 0) {
    return '检测到多个作者目录来源，请移除多余的导入目录后再同步。';
  }

  const joined = uniquePaths.join('；');
  return `检测到多个作者目录来源：${joined}。请只保留一个作者目录来源后再同步。`;
}

export function registerLibraryIpc(context: IpcContext): void {
  const { repositories, scanner, scanQueue } = context;
  const { library, manga, tag, sourceMetadata } = repositories;

  const addSourcesInternal = async (rawPaths: string[]) => {
    const existingPaths = new Set(library.list().map((source) => source.path));
    const added: LibraryFolder[] = [];
    const skipped: Array<{ path: string; reason: AddSourceSkipReason }> = [];
    const acceptedScanPaths: string[] = [];
    const detectedAuthorRootPaths = new Set(await findAuthorRootSources(library));

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

      const isAuthorRoot = await detectAuthorRootDirectory(normalizedPath);
      if (isAuthorRoot && detectedAuthorRootPaths.size > 0 && !detectedAuthorRootPaths.has(normalizedPath)) {
        skipped.push({ path: normalizedPath, reason: 'ORGANIZER_ROOT_CONFLICT' });
        continue;
      }

      const source = library.add(normalizedPath, pathToDisplayName(normalizedPath));
      sourceMetadata.ensureSourceMetadataDb(normalizedPath);
      existingPaths.add(normalizedPath);
      acceptedScanPaths.push(normalizedPath);
      added.push(source);
      if (isAuthorRoot) {
        detectedAuthorRootPaths.add(normalizedPath);
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
    const conflictPaths = [
      ...(firstSkip?.reason === 'ORGANIZER_ROOT_CONFLICT' && firstSkip?.path ? [firstSkip.path] : []),
      ...(await findAuthorRootSources(library))
    ];
    const message =
      firstSkip?.reason === 'DUPLICATE'
        ? 'Source already exists'
        : firstSkip?.reason === 'NOT_FOUND'
          ? `Directory does not exist: ${firstSkip.path}`
          : firstSkip?.reason === 'ORGANIZER_ROOT_CONFLICT'
            ? formatAuthorRootConflictMessage(conflictPaths)
          : 'Invalid source path';

    return fail('ADD_SOURCE_FAILED', message);
  });

  registerHandler('library.removeSource', async (request) => {
    const source = library.getById(request.id);
    if (!source) {
      return fail('NOT_FOUND', 'Source not found');
    }

    const removed = library.remove(request.id);
    return ok({ removed });
  });

  registerHandler('library.openSourceFolder', async (request) => {
    const sourcePath = request?.path?.trim();
    if (!sourcePath) {
      return fail('VALIDATION', 'Source path is required');
    }

    const normalizedPath = normalizeAbsolutePath(sourcePath);
    const exists = await directoryExists(normalizedPath);
    if (!exists) {
      return fail('NOT_FOUND', `Directory does not exist: ${normalizedPath}`);
    }

    await shell.openPath(normalizedPath);
    return ok({ opened: true });
  });

  registerHandler('library.listSources', async () => {
    const sources = library.list();
    const authorRootPaths = await findAuthorRootSources(library);
    const hasSingleAuthorRoot = authorRootPaths.length === 1;
    const authorRootSet = new Set(authorRootPaths);
    return ok(
      sources.map((source) => ({
        ...source,
        isTarget: hasSingleAuthorRoot && authorRootSet.has(normalizeAbsolutePath(source.path))
      }))
    );
  });

  registerHandler('library.syncSources', async (request) => {
    const paths = request?.paths?.length ? request.paths : library.list().map((item) => item.path);
    const forceRescan = request?.forceRescan ?? true;

    if (paths.length === 0) {
      return fail('NO_SOURCES', '请先添加至少一个漫画来源目录。');
    }

    const authorRootPaths = await findAuthorRootSources(library);
    if (authorRootPaths.length > 1) {
      return fail('AUTHOR_ROOT_CONFLICT', formatAuthorRootConflictMessage(authorRootPaths));
    }

    for (const sourcePath of paths) {
      sourceMetadata.ensureSourceMetadataDb(sourcePath);
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
    const tagsByMangaId = tag.listByMangaIds(books.map((book) => book.id));
    const booksWithCover = books.map((book) => ({
      ...book,
      coverPath: null,
      tags: tagsByMangaId[book.id] ?? []
    }));

    return ok(booksWithCover);
  });

  registerHandler('library.listCoverPaths', async (request) => {
    const folderPaths = Array.from(new Set((request?.folderPaths ?? []).map((item) => normalizeAbsolutePath(item))));
    const entries = await Promise.all(
      folderPaths.map(async (folderPath) => [folderPath, await resolveCoverPath(folderPath)] as const)
    );
    return ok(Object.fromEntries(entries));
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
