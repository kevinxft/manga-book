import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { app, dialog, shell } from 'electron';
import type { IpcContext } from './context';
import { registerHandler, ok, fail } from './helpers';
import { directoryExists, ensureDirectory, movePath, pathExists } from '@main/utils/fsUtils';
import { normalizeAbsolutePath, pathToDisplayName } from '@main/utils/pathUtils';
import { clearCoverPathCache, resolveCoverPath } from '@main/scanner/coverFinder';
import type { LibraryImportDirectoriesResult, LibraryRoot } from '@shared/types';
import {
  getAuthorsDirectoryPath,
  getLibraryRootPath,
  getUnsortedDirectoryPath,
  isPathInsideDirectory
} from './organizer.common';

const execFileAsync = promisify(execFile);
const LIBRARY_METADATA_DIRNAME = '.mangabook';
const LIBRARY_MARKER_FILENAME = 'library.json';
const LIBRARY_ROOT_SUFFIX = '.mangalibrary';

function ensureLibraryRootSuffix(directoryName: string): string {
  const trimmedName = directoryName.trim();
  if (!trimmedName) {
    return trimmedName;
  }

  return trimmedName.toLocaleLowerCase().endsWith(LIBRARY_ROOT_SUFFIX)
    ? trimmedName
    : `${trimmedName}${LIBRARY_ROOT_SUFFIX}`;
}

function toLibraryDisplayName(rootPath: string): string {
  const displayName = pathToDisplayName(rootPath);
  return displayName.toLocaleLowerCase().endsWith(LIBRARY_ROOT_SUFFIX)
    ? displayName.slice(0, -LIBRARY_ROOT_SUFFIX.length)
    : displayName;
}

function getAppIconPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(app.getAppPath(), 'build/icon.png');
}

async function resolveLibraryFolderIconPath(): Promise<string> {
  const candidates = [
    path.join(process.resourcesPath, 'library-folder-icon.png'),
    path.join(app.getAppPath(), 'build/library-folder-icon.png'),
    getAppIconPath()
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  return getAppIconPath();
}

async function applyFolderIconWithSystemTools(rootPath: string): Promise<boolean> {
  const iconPath = await resolveLibraryFolderIconPath();
  const tempDirectoryPath = await fs.mkdtemp(path.join(os.tmpdir(), 'mangabook-folder-icon-'));
  const tempIconPath = path.join(tempDirectoryPath, 'icon.png');
  const iconResourcePath = path.join(tempDirectoryPath, 'icon.rsrc');
  const folderIconPath = path.join(rootPath, 'Icon\r');

  try {
    await fs.copyFile(iconPath, tempIconPath);
    await execFileAsync('/usr/bin/sips', ['-i', tempIconPath]);
    const { stdout } = await execFileAsync('/usr/bin/DeRez', ['-only', 'icns', tempIconPath], {
      maxBuffer: 32 * 1024 * 1024
    });

    await fs.writeFile(iconResourcePath, stdout, 'utf8');
    await fs.rm(folderIconPath, { force: true });
    await execFileAsync('/usr/bin/Rez', ['-append', iconResourcePath, '-o', folderIconPath], {
      maxBuffer: 32 * 1024 * 1024
    });
    await execFileAsync('/usr/bin/SetFile', ['-a', 'V', folderIconPath]);
    await execFileAsync('/usr/bin/SetFile', ['-a', 'C', folderIconPath]);
    await execFileAsync('/usr/bin/SetFile', ['-a', 'C', rootPath]);
    return true;
  } catch {
    return false;
  } finally {
    await fs.rm(tempDirectoryPath, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function applyFolderIcon(rootPath: string): Promise<boolean> {
  if (process.platform !== 'darwin') {
    return false;
  }

  const iconPath = await resolveLibraryFolderIconPath();
  try {
    await execFileAsync('/usr/bin/env', ['fileicon', 'set', rootPath, iconPath]);
    return true;
  } catch {
    return applyFolderIconWithSystemTools(rootPath);
  }
}

async function ensureLibraryStructure(rootPath: string): Promise<{ initializedAt: string; hasCustomIcon: boolean }> {
  const authorsPath = getAuthorsDirectoryPath(rootPath);
  const unsortedPath = getUnsortedDirectoryPath(rootPath);
  const metadataPath = path.join(rootPath, LIBRARY_METADATA_DIRNAME);
  const markerPath = path.join(metadataPath, LIBRARY_MARKER_FILENAME);

  await Promise.all([ensureDirectory(rootPath), ensureDirectory(authorsPath), ensureDirectory(unsortedPath), ensureDirectory(metadataPath)]);

  let initializedAt = new Date().toISOString();

  try {
    const existing = JSON.parse(await fs.readFile(markerPath, 'utf8')) as { initializedAt?: string } | null;
    if (existing?.initializedAt) {
      initializedAt = existing.initializedAt;
    }
  } catch {
    // Ignore marker read errors and rewrite it below.
  }

  const hasCustomIcon = await applyFolderIcon(rootPath);
  await fs.writeFile(
    markerPath,
    JSON.stringify(
      {
        initializedAt,
        app: 'manga-book',
        structure: {
          authors: 'Authors',
          unsorted: 'Unsorted'
        },
        hasCustomIcon
      },
      null,
      2
    ),
    'utf8'
  );

  return { initializedAt, hasCustomIcon };
}

async function getAvailableDirectoryPath(
  destinationRoot: string,
  preferredName: string
): Promise<{ path: string; renamedDueToConflict: boolean }> {
  for (let index = 0; index < 10_000; index += 1) {
    const candidateName = index === 0 ? preferredName : `${preferredName}（${index}）`;
    const candidatePath = normalizeAbsolutePath(path.join(destinationRoot, candidateName));
    if (!(await pathExists(candidatePath))) {
      return { path: candidatePath, renamedDueToConflict: index > 0 };
    }
  }

  throw new Error(`Unable to resolve destination path for ${preferredName}`);
}

function toStoredRoot(root: LibraryRoot | null): LibraryRoot | null {
  return root
    ? {
        ...root,
        path: normalizeAbsolutePath(root.path)
      }
    : null;
}

export function registerLibraryIpc(context: IpcContext): void {
  const { repositories, scanner, scanQueue } = context;
  const { library, manga, tag } = repositories;

  const runLibrarySync = async (rootPath: string, forceRescan = true) => {
    const taskId = scanQueue.enqueue({
      name: 'Library sync',
      run: async (signal, reportProgress) => {
        if (forceRescan) {
          clearCoverPathCache();
        }
        await scanner.syncSources([rootPath], reportProgress, signal);
      }
    });

    return { taskId };
  };

  const importDirectoriesInternal = async (rawPaths: string[]): Promise<LibraryImportDirectoriesResult> => {
    const rootPath = getLibraryRootPath(library);
    if (!rootPath) {
      throw new Error('NO_LIBRARY_ROOT');
    }

    const unsortedPath = getUnsortedDirectoryPath(rootPath);
    await ensureLibraryStructure(rootPath);

    const imported: LibraryImportDirectoriesResult['imported'] = [];
    const skipped: LibraryImportDirectoriesResult['skipped'] = [];

    for (const rawPath of rawPaths) {
      if (!rawPath?.trim()) {
        skipped.push({ path: rawPath ?? '', reason: 'INVALID' });
        continue;
      }

      const normalizedPath = normalizeAbsolutePath(rawPath);
      if (normalizedPath === rootPath || isPathInsideDirectory(normalizedPath, rootPath)) {
        skipped.push({ path: normalizedPath, reason: 'INSIDE_LIBRARY' });
        continue;
      }

      if (!(await directoryExists(normalizedPath))) {
        skipped.push({ path: normalizedPath, reason: 'NOT_FOUND' });
        continue;
      }

      const moveTarget = await getAvailableDirectoryPath(unsortedPath, path.basename(normalizedPath));
      await movePath(normalizedPath, moveTarget.path);
      imported.push({
        sourcePath: normalizedPath,
        targetPath: moveTarget.path,
        renamedDueToConflict: moveTarget.renamedDueToConflict
      });
    }

    const syncResult = imported.length > 0 ? await runLibrarySync(rootPath, true) : { taskId: null };
    return {
      imported,
      skipped,
      taskId: syncResult.taskId
    };
  };

  registerHandler('library.pickLibraryRootDirectory', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择漫画库上级目录',
      properties: ['openDirectory', 'dontAddToRecent']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return ok({ paths: [] });
    }

    return ok({ paths: [normalizeAbsolutePath(result.filePaths[0] as string)] });
  });

  registerHandler('library.getRoot', async () => {
    return ok(toStoredRoot(library.getRoot()));
  });

  registerHandler('library.clearRoot', async () => {
    library.clear();
    clearCoverPathCache();
    return ok({ cleared: true });
  });

  registerHandler('library.setRoot', async (request) => {
    const rawPath = request?.path?.trim();
    const rawParentPath = request?.parentPath?.trim();
    const rawDirectoryName = request?.directoryName?.trim();
    const normalizedRootPath = rawPath
      ? normalizeAbsolutePath(rawPath)
      : rawParentPath && rawDirectoryName
        ? normalizeAbsolutePath(path.join(rawParentPath, ensureLibraryRootSuffix(rawDirectoryName)))
        : '';

    if (!normalizedRootPath) {
      return fail('VALIDATION', 'Library root path is required.');
    }

    const existingAsDirectory = await directoryExists(normalizedRootPath);
    if (!existingAsDirectory) {
      const parentPath = normalizeAbsolutePath(path.dirname(normalizedRootPath));
      if (!(await directoryExists(parentPath))) {
        return fail('NOT_FOUND', `Parent directory does not exist: ${parentPath}`);
      }
    }

    const structure = await ensureLibraryStructure(normalizedRootPath);
    const stored = library.setRoot(normalizedRootPath, toLibraryDisplayName(normalizedRootPath), {
      hasCustomIcon: structure.hasCustomIcon
    });

    return ok({
      ...stored,
      initializedAt: structure.initializedAt,
      hasCustomIcon: structure.hasCustomIcon
    });
  });

  registerHandler('library.openRoot', async (request) => {
    const storedRootPath = getLibraryRootPath(library);
    const sourcePath = request?.path?.trim() || storedRootPath;
    if (!sourcePath) {
      return fail('NO_LIBRARY_ROOT', '请先设置漫画库。');
    }

    const normalizedPath = normalizeAbsolutePath(sourcePath);
    if (!(await directoryExists(normalizedPath))) {
      return fail('NOT_FOUND', `Directory does not exist: ${normalizedPath}`);
    }

    await shell.openPath(normalizedPath);
    return ok({ opened: true });
  });

  registerHandler('library.pickImportDirectories', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择要导入到漫画库的漫画目录',
      properties: ['openDirectory', 'multiSelections', 'dontAddToRecent']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return ok({ paths: [] });
    }

    return ok({ paths: result.filePaths.map((filePath) => normalizeAbsolutePath(filePath)) });
  });

  registerHandler('library.importDirectories', async (request) => {
    const paths = request?.paths ?? [];
    if (paths.length === 0) {
      return fail('VALIDATION', 'At least one directory is required.');
    }

    const rootPath = getLibraryRootPath(library);
    if (!rootPath) {
      return fail('NO_LIBRARY_ROOT', '请先设置漫画库。');
    }

    try {
      return ok(await importDirectoriesInternal(paths));
    } catch (error) {
      if (error instanceof Error && error.message === 'NO_LIBRARY_ROOT') {
        return fail('NO_LIBRARY_ROOT', '请先设置漫画库。');
      }
      throw error;
    }
  });

  registerHandler('library.syncLibrary', async (request) => {
    const rootPath = getLibraryRootPath(library);
    if (!rootPath) {
      return fail('NO_LIBRARY_ROOT', '请先设置漫画库。');
    }

    await ensureLibraryStructure(rootPath);
    return ok(await runLibrarySync(rootPath, request?.forceRescan ?? true));
  });

  // Legacy handlers kept as thin wrappers during the UI refactor.
  registerHandler('library.pickSourceDirectories', async () => {
    return ok(await dialog.showOpenDialog({
      title: '选择要导入到漫画库的漫画目录',
      properties: ['openDirectory', 'multiSelections', 'dontAddToRecent']
    }).then((result) => ({
      paths: result.canceled ? [] : result.filePaths.map((filePath) => normalizeAbsolutePath(filePath))
    })));
  });

  registerHandler('library.addSources', async (request) => {
    const result = await importDirectoriesInternal(request?.paths ?? []);
    return ok({
      added: [],
      skipped: result.skipped.map((item) => ({
        path: item.path,
        reason:
          item.reason === 'NOT_FOUND'
            ? 'NOT_FOUND'
            : item.reason === 'INSIDE_LIBRARY'
              ? 'INVALID'
              : item.reason === 'DUPLICATE'
                ? 'DUPLICATE'
                : 'INVALID'
      })),
      taskId: result.taskId
    });
  });

  registerHandler('library.addSource', async (request) => {
    const result = await importDirectoriesInternal([request?.path ?? '']);
    if (result.imported.length === 0) {
      const firstSkip = result.skipped[0];
      return fail('ADD_SOURCE_FAILED', firstSkip ? `导入失败：${firstSkip.path}` : '导入失败');
    }
    return ok({
      id: result.imported[0]?.targetPath ?? '',
      path: result.imported[0]?.targetPath ?? '',
      displayName: path.basename(result.imported[0]?.targetPath ?? ''),
      addedAt: new Date().toISOString(),
      isTarget: false
    });
  });

  registerHandler('library.removeSource', async () => {
    return ok({ removed: false });
  });

  registerHandler('library.openSourceFolder', async (request) => {
    const normalizedPath = normalizeAbsolutePath(request?.path ?? '');
    if (!(await directoryExists(normalizedPath))) {
      return fail('NOT_FOUND', `Directory does not exist: ${normalizedPath}`);
    }

    await shell.openPath(normalizedPath);
    return ok({ opened: true });
  });

  registerHandler('library.listSources', async () => {
    const root = library.getRoot();
    return ok(
      root
        ? [
            {
              id: root.path,
              path: root.path,
              displayName: root.displayName,
              addedAt: root.initializedAt,
              isTarget: true
            }
          ]
        : []
    );
  });

  registerHandler('library.syncSources', async (request) => {
    const rootPath = getLibraryRootPath(library);
    if (!rootPath) {
      return fail('NO_LIBRARY_ROOT', '请先设置漫画库。');
    }
    return ok(await runLibrarySync(rootPath, request?.forceRescan ?? true));
  });

  registerHandler('library.cancelSync', async (request) => {
    const requestedTaskId = request?.taskId?.trim() ?? '';
    const activeTask = scanQueue.getActiveTask();
    const taskId = requestedTaskId || activeTask?.id || null;

    if (!taskId) {
      return ok({ cancelled: false, taskId: null });
    }

    const cancelled = scanQueue.cancel(taskId);
    if (!cancelled) {
      return fail('NOT_FOUND', '当前没有可取消的同步任务。');
    }

    return ok({ cancelled: true, taskId });
  });

  registerHandler('library.listMangas', async (request) => {
    const books = manga.list(request ?? undefined);
    const tagsByMangaId = tag.listByMangaIds(books.map((book) => book.id));
    return ok(
      books.map((book) => ({
        ...book,
        coverPath: null,
        tags: tagsByMangaId[book.id] ?? []
      }))
    );
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
        status: 'idle',
        current: 0,
        total: 0,
        message: 'Idle',
        sourceCurrent: 0,
        sourceTotal: 0,
        sourceName: '',
        itemCurrent: 0,
        itemTotal: 0,
        currentItemName: ''
      });
    }

    return ok({
      taskId: activeTask.id,
      status: activeTask.status === 'running' ? 'running' : 'idle',
      current: activeTask.progress.current,
      total: activeTask.progress.total,
      message: activeTask.progress.message,
      sourceCurrent: activeTask.progress.sourceCurrent ?? 0,
      sourceTotal: activeTask.progress.sourceTotal ?? 0,
      sourceName: activeTask.progress.sourceName ?? '',
      itemCurrent: activeTask.progress.itemCurrent ?? 0,
      itemTotal: activeTask.progress.itemTotal ?? 0,
      currentItemName: activeTask.progress.currentItemName ?? ''
    });
  });

  registerHandler('library.getScanTaskStatus', async (request) => {
    const taskId = request?.taskId?.trim();
    if (!taskId) {
      return fail('VALIDATION', 'Task id is required.');
    }

    const task = scanQueue.getTask(taskId);
    if (!task) {
      return fail('NOT_FOUND', 'Scan task not found.');
    }

    return ok({
      taskId: task.id,
      status: task.status,
      current: task.progress.current,
      total: task.progress.total,
      message: task.progress.message,
      sourceCurrent: task.progress.sourceCurrent ?? 0,
      sourceTotal: task.progress.sourceTotal ?? 0,
      sourceName: task.progress.sourceName ?? '',
      itemCurrent: task.progress.itemCurrent ?? 0,
      itemTotal: task.progress.itemTotal ?? 0,
      currentItemName: task.progress.currentItemName ?? '',
      ...(task.error ? { error: task.error } : {})
    });
  });
}
