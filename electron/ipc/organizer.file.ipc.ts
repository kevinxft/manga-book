import fs from 'node:fs/promises';
import path from 'node:path';
import { dialog, shell } from 'electron';
import type { DirectoryAlias, MangaStructure, OrganizerMergedMangaPath } from '@shared/types';
import type { IpcContext } from './context';
import { fail, ok, registerHandler } from './helpers';
import { invalidateAliasListCache, updateCachedCanonicalName } from './organizer.alias.ipc';
import {
  getAuthorsDirectoryPath,
  getLibraryRootPath,
  isPathInsideDirectory,
  listAuthorDirectories,
  resolveSourceFolderPath
} from './organizer.common';
import { directoryExists, ensureDirectory, listDirectories, movePath, pathExists } from '@main/utils/fsUtils';
import { normalizeAbsolutePath, toKey } from '@main/utils/pathUtils';
import { clearCoverPathCache, invalidateCoverPath } from '@main/scanner/coverFinder';
import { isMetadataDirectoryPath } from '@main/db/sourceMetadata';

const AUTHOR_ALIAS_METADATA_FILENAME = '.mangabook-author.json';
const IGNORABLE_AUTHOR_DIRECTORY_FILES = new Set([AUTHOR_ALIAS_METADATA_FILENAME, '.DS_Store']);
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MIN_MANGA_IMAGE_COUNT = 4;

async function getAvailableDirectoryPath(
  destinationRoot: string,
  preferredName: string,
  currentPath?: string
): Promise<{ path: string; renamedDueToConflict: boolean }> {
  const normalizedCurrentPath = currentPath ? normalizeAbsolutePath(currentPath) : null;

  for (let index = 0; index < 10_000; index += 1) {
    const candidateName = index === 0 ? preferredName : `${preferredName}（${index}）`;
    const candidatePath = normalizeAbsolutePath(path.join(destinationRoot, candidateName));

    if (normalizedCurrentPath && candidatePath === normalizedCurrentPath) {
      return { path: candidatePath, renamedDueToConflict: false };
    }

    if (!(await pathExists(candidatePath))) {
      return { path: candidatePath, renamedDueToConflict: index > 0 };
    }
  }

  throw new Error(`Unable to find available directory name for ${preferredName}`);
}

function isValidAuthorDirectoryName(name: string): boolean {
  return Boolean(name) && name !== '.' && name !== '..' && !/[\\/]/.test(name);
}

async function assertDirectoryHasOnlyChildDirectories(directoryPath: string): Promise<string | null> {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  const unsupportedEntry = entries.find(
    (entry) =>
      isMetadataDirectoryPath(path.join(directoryPath, entry.name)) ||
      (!entry.isDirectory() && !IGNORABLE_AUTHOR_DIRECTORY_FILES.has(entry.name))
  );
  return unsupportedEntry?.name ?? null;
}

async function listImageFiles(directoryPath: string): Promise<string[]> {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => path.join(directoryPath, entry.name));
}

async function inspectImportableMangaDirectory(
  directoryPath: string
): Promise<{ structure: MangaStructure; totalPages: number } | null> {
  const directImages = await listImageFiles(directoryPath);
  if (directImages.length >= MIN_MANGA_IMAGE_COUNT) {
    return {
      structure: 'singleVolume',
      totalPages: directImages.length
    };
  }

  const childDirectories = (await listDirectories(directoryPath)).filter((childPath) => !isMetadataDirectoryPath(childPath));
  let totalChildPages = 0;
  let hasChildVolume = false;

  for (const childDirectory of childDirectories) {
    const childImages = await listImageFiles(childDirectory);
    if (childImages.length === 0) {
      continue;
    }
    hasChildVolume = true;
    totalChildPages += childImages.length;
  }

  if (!hasChildVolume) {
    return null;
  }

  return {
    structure: 'multiVolume',
    totalPages: totalChildPages
  };
}


export function registerOrganizerFileIpc(context: IpcContext): void {
  const { manga, library, directoryUsage, alias } = context.repositories;

  registerHandler('organizer.moveManga', async (request) => {
    const book = manga.getById(request.mangaId);
    if (!book) {
      return fail('NOT_FOUND', 'Manga not found');
    }

    const destinationRoot = normalizeAbsolutePath(request.destinationPath);
    await ensureDirectory(destinationRoot);

    const moveTarget = await getAvailableDirectoryPath(destinationRoot, path.basename(book.folderPath), book.folderPath);
    const nextFolderPath = moveTarget.path;
    await movePath(book.folderPath, nextFolderPath);

    const sourceRootPath = getLibraryRootPath(library);
    const sourcePaths = sourceRootPath ? [sourceRootPath] : [];
    const nextSourceFolderPath = resolveSourceFolderPath(nextFolderPath, sourcePaths, book.sourceFolderPath);

    invalidateCoverPath(book.folderPath);
    const updated = manga.updatePath(book.id, path.basename(nextFolderPath), nextFolderPath, nextSourceFolderPath);
    directoryUsage.touch(destinationRoot);

    return ok({
      manga: updated,
      renamedDueToConflict: moveTarget.renamedDueToConflict
    });
  });

  registerHandler('organizer.renameManga', async (request) => {
    const book = manga.getById(request.mangaId);
    if (!book) {
      return fail('NOT_FOUND', 'Manga not found');
    }

    const parentDirectory = path.dirname(book.folderPath);
    const nextFolderPath = path.join(parentDirectory, request.newTitle);

    await movePath(book.folderPath, nextFolderPath);

    const sourceRootPath = getLibraryRootPath(library);
    const sourcePaths = sourceRootPath ? [sourceRootPath] : [];
    const nextSourceFolderPath = resolveSourceFolderPath(nextFolderPath, sourcePaths, book.sourceFolderPath);

    invalidateCoverPath(book.folderPath);
    const updated = manga.updatePath(book.id, request.newTitle, nextFolderPath, nextSourceFolderPath);

    return ok(updated);
  });

  registerHandler('organizer.openMangaFolder', async (request) => {
    const book = manga.getById(request.mangaId);
    if (!book) {
      return fail('NOT_FOUND', 'Manga not found');
    }

    await shell.openPath(book.folderPath);
    return ok({ opened: true });
  });

  registerHandler('organizer.listAuthorDirectories', async () => {
    const directories = await listAuthorDirectories(library);
    const libraryRootPath = getLibraryRootPath(library);
    const normalizedRoots = libraryRootPath ? [getAuthorsDirectoryPath(libraryRootPath)] : [];

    const mangaBooks = manga.list();
    const uniqueDirectories = Array.from(new Set(directories)).sort((a, b) => a.localeCompare(b));
    const countByDirectory = new Map(uniqueDirectories.map((directory) => [directory, 0]));

    for (const book of mangaBooks) {
      const bookFolderPath = normalizeAbsolutePath(book.folderPath);

      for (const rootPath of normalizedRoots) {
        const prefix = `${rootPath}${path.sep}`;
        if (!bookFolderPath.startsWith(prefix)) {
          continue;
        }

        const relativePath = path.relative(rootPath, bookFolderPath);
        const authorName = relativePath.split(path.sep).filter(Boolean)[0];
        if (!authorName) {
          break;
        }

        const authorDirectory = normalizeAbsolutePath(path.join(rootPath, authorName));
        countByDirectory.set(authorDirectory, (countByDirectory.get(authorDirectory) ?? 0) + 1);
        break;
      }
    }

    const usageByPath = new Map(
      directoryUsage.listByPaths(uniqueDirectories).map((item) => [normalizeAbsolutePath(item.directoryPath), item.lastMovedAt])
    );
    const summaries = uniqueDirectories.map((directory) => {
      const normalizedDirectory = normalizeAbsolutePath(directory);
      return {
        directory: normalizedDirectory,
        mangaCount: countByDirectory.get(normalizedDirectory) ?? 0,
        lastMovedAt: usageByPath.get(normalizedDirectory) ?? null
      };
    });

    return ok(summaries);
  });

  registerHandler('organizer.createAuthorDirectory', async (request) => {
    const name = request.name?.trim();
    if (!name) {
      return fail('VALIDATION', 'Author name is required');
    }
    if (name === '.' || name === '..' || /[\\/]/.test(name)) {
      return fail('VALIDATION', 'Invalid author directory name');
    }

    const libraryRootPath = getLibraryRootPath(library);
    if (!libraryRootPath) {
      return fail('NO_TARGET_ROOT', '请先设置漫画库。');
    }

    const authorsRootPath = getAuthorsDirectoryPath(libraryRootPath);
    await ensureDirectory(authorsRootPath);

    let targetRoot = authorsRootPath;
    const preferredBasePath = request.basePath?.trim();
    if (preferredBasePath) {
      const normalizedBasePath = normalizeAbsolutePath(preferredBasePath);
      const normalizedBaseParent = normalizeAbsolutePath(path.dirname(normalizedBasePath));
      const matchedRoot =
        authorsRootPath === normalizedBasePath || authorsRootPath === normalizedBaseParent ? authorsRootPath : null;
      if (matchedRoot) {
        targetRoot = matchedRoot;
      }
    }

    const targetPath = normalizeAbsolutePath(path.join(targetRoot, name));
    const exists = await directoryExists(targetPath);
    if (!exists) {
      await ensureDirectory(targetPath);
      return ok({ path: targetPath, created: true });
    }

    return ok({ path: targetPath, created: false });
  });

  registerHandler('organizer.renameAuthorDirectory', async (request) => {
    const currentPath = normalizeAbsolutePath(request.directoryPath);
    const nextName = request.newName?.trim();

    if (!nextName) {
      return fail('VALIDATION', 'Author name is required');
    }
    if (nextName === '.' || nextName === '..' || /[\\/]/.test(nextName)) {
      return fail('VALIDATION', 'Invalid author directory name');
    }

    if (!(await directoryExists(currentPath))) {
      return fail('NOT_FOUND', 'Author directory not found');
    }

    const previousName = path.basename(currentPath);
    const nextPath = normalizeAbsolutePath(path.join(path.dirname(currentPath), nextName));

    if (nextPath === currentPath) {
      return ok({
        previousPath: currentPath,
        path: currentPath,
        previousName,
        name: nextName,
        updatedCount: 0
      });
    }

    if (await pathExists(nextPath)) {
      return fail('CONFLICT', 'Author directory already exists');
    }

    await movePath(currentPath, nextPath);

    const updatedCount = manga.renameDirectoryPrefix(currentPath, nextPath);
    clearCoverPathCache();

    alias.updateCanonicalName(previousName, nextName, nextPath);
    updateCachedCanonicalName(previousName, nextName);

    return ok({
      previousPath: currentPath,
      path: nextPath,
      previousName,
      name: nextName,
      updatedCount
    });
  });

  registerHandler('organizer.mergeAuthorDirectories', async (request) => {
    const sourceDirectoryPaths = Array.from(
      new Set((request.sourceDirectoryPaths ?? []).map((item) => normalizeAbsolutePath(item)).filter(Boolean))
    );
    const targetName = request.targetName?.trim() ?? '';

    if (sourceDirectoryPaths.length < 2) {
      return fail('VALIDATION', 'At least two author directories are required');
    }
    if (!isValidAuthorDirectoryName(targetName)) {
      return fail('VALIDATION', 'Invalid author directory name');
    }

    const parentPath = normalizeAbsolutePath(path.dirname(sourceDirectoryPaths[0] as string));
    for (const sourcePath of sourceDirectoryPaths) {
      if (normalizeAbsolutePath(path.dirname(sourcePath)) !== parentPath) {
        return fail('VALIDATION', 'Author directories must be under the same root');
      }
      if (!(await directoryExists(sourcePath))) {
        return fail('NOT_FOUND', `Author directory not found: ${sourcePath}`);
      }
    }

    const targetPath = normalizeAbsolutePath(path.join(parentPath, targetName));
    const targetExists = await pathExists(targetPath);
    if (targetExists && !(await directoryExists(targetPath))) {
      return fail('CONFLICT', 'Merge target already exists and is not a directory');
    }

    for (const sourcePath of sourceDirectoryPaths) {
      if (sourcePath === targetPath) {
        continue;
      }

      const unsupportedEntry = await assertDirectoryHasOnlyChildDirectories(sourcePath);
      if (unsupportedEntry) {
        return fail('DIRECTORY_NOT_EMPTY', `源目录包含无法合并的文件：${path.basename(sourcePath)}/${unsupportedEntry}`);
      }
    }

    if (!targetExists) {
      await ensureDirectory(targetPath);
    }

    const sourceRootPath = getLibraryRootPath(library);
    const sourceRoots = sourceRootPath ? [sourceRootPath] : [];
    const booksByFolderPath = new Map(manga.list().map((book) => [normalizeAbsolutePath(book.folderPath), book]));
    const movedMangas: OrganizerMergedMangaPath[] = [];
    const deletedSourcePaths: string[] = [];
    let renamedConflictCount = 0;

    for (const sourcePath of sourceDirectoryPaths) {
      if (sourcePath === targetPath) {
        continue;
      }

      const childDirectories = (await listDirectories(sourcePath))
        .map((childPath) => normalizeAbsolutePath(childPath))
        .filter((childPath) => !isMetadataDirectoryPath(childPath));

      for (const childPath of childDirectories) {
        const moveTarget = await getAvailableDirectoryPath(targetPath, path.basename(childPath));
        await movePath(childPath, moveTarget.path);
        if (moveTarget.renamedDueToConflict) {
          renamedConflictCount += 1;
        }

        const book = booksByFolderPath.get(childPath);
        if (!book) {
          continue;
        }

        invalidateCoverPath(book.folderPath);
        const nextSourceFolderPath = resolveSourceFolderPath(moveTarget.path, sourceRoots, book.sourceFolderPath);
        const updated = manga.updatePath(book.id, path.basename(moveTarget.path), moveTarget.path, nextSourceFolderPath);
        movedMangas.push({
          id: updated.id,
          previousPath: book.folderPath,
          path: updated.folderPath,
          title: updated.title,
          renamedDueToConflict: moveTarget.renamedDueToConflict
        });
      }

      await Promise.all(
        [...IGNORABLE_AUTHOR_DIRECTORY_FILES].map((fileName) => fs.rm(path.join(sourcePath, fileName), { force: true }))
      );
      await fs.rmdir(sourcePath);
      deletedSourcePaths.push(sourcePath);
    }

    if (movedMangas.length > 0) {
      directoryUsage.touch(targetPath);
      clearCoverPathCache();
    }

    const sourceNames = sourceDirectoryPaths.map((sourcePath) => path.basename(sourcePath));
    const sourceNameKeys = new Set(sourceNames.map((sourceName) => toKey(sourceName)));
    const aliasCandidates = new Map<string, string>();

    for (const sourceName of sourceNames) {
      aliasCandidates.set(toKey(sourceName), sourceName);
    }

    for (const aliasItem of alias.list()) {
      if (sourceNameKeys.has(toKey(aliasItem.canonicalName))) {
        aliasCandidates.set(toKey(aliasItem.alias), aliasItem.alias);
      }
    }

    const storedAliases: DirectoryAlias[] = [];
    const targetNameKey = toKey(targetName);
    for (const [aliasKey, aliasName] of aliasCandidates) {
      if (!aliasKey || aliasKey === targetNameKey) {
        continue;
      }

      storedAliases.push(alias.insert(aliasName, targetName, targetPath));
    }
    invalidateAliasListCache();

    return ok({
      targetPath,
      targetName,
      movedMangas,
      deletedSourcePaths,
      aliases: storedAliases,
      renamedConflictCount
    });
  });

  registerHandler('organizer.importMangasToAuthorDirectory', async (request) => {
    const targetDirectoryPath = normalizeAbsolutePath(request.directoryPath);
    if (!(await directoryExists(targetDirectoryPath))) {
      return fail('NOT_FOUND', 'Author directory not found');
    }

    const targetSourceRoot = getLibraryRootPath(library);
    if (!targetSourceRoot) {
      return fail('NO_SOURCE_ROOT', '请先设置漫画库。');
    }

    const result = await dialog.showOpenDialog({
      title: `选择要导入到「${path.basename(targetDirectoryPath)}」的漫画目录`,
      properties: ['openDirectory', 'multiSelections', 'dontAddToRecent']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return ok({
        cancelled: true,
        importedCount: 0,
        renamedConflictCount: 0,
        skipped: []
      });
    }

    const selectedPaths = Array.from(
      new Set(result.filePaths.map((filePath) => normalizeAbsolutePath(filePath)).filter(Boolean))
    );
    const existingMangaByFolderPath = new Map(
      manga.list().map((book) => [normalizeAbsolutePath(book.folderPath), book])
    );
    const skipped: Array<{
      path: string;
      reason: 'NOT_FOUND' | 'INVALID_MANGA_DIRECTORY' | 'ALREADY_IN_TARGET';
    }> = [];
    let importedCount = 0;
    let renamedConflictCount = 0;

    for (const selectedPath of selectedPaths) {
      if (selectedPath === targetDirectoryPath || selectedPath.startsWith(`${targetDirectoryPath}${path.sep}`)) {
        skipped.push({ path: selectedPath, reason: 'ALREADY_IN_TARGET' });
        continue;
      }

      if (!(await directoryExists(selectedPath))) {
        skipped.push({ path: selectedPath, reason: 'NOT_FOUND' });
        continue;
      }

      const inspection = await inspectImportableMangaDirectory(selectedPath);
      if (!inspection) {
        skipped.push({ path: selectedPath, reason: 'INVALID_MANGA_DIRECTORY' });
        continue;
      }

      const moveTarget = await getAvailableDirectoryPath(targetDirectoryPath, path.basename(selectedPath));
      await movePath(selectedPath, moveTarget.path);

      importedCount += 1;
      if (moveTarget.renamedDueToConflict) {
        renamedConflictCount += 1;
      }

      const existing = existingMangaByFolderPath.get(selectedPath);
      if (existing) {
        invalidateCoverPath(existing.folderPath);
        manga.updatePath(existing.id, path.basename(moveTarget.path), moveTarget.path, targetSourceRoot);
      } else {
        manga.upsert({
          title: path.basename(moveTarget.path),
          folderPath: moveTarget.path,
          sourceFolderPath: targetSourceRoot,
          structure: inspection.structure,
          totalPages: inspection.totalPages
        });
      }

      invalidateCoverPath(selectedPath);
      invalidateCoverPath(moveTarget.path);
    }

    if (importedCount > 0) {
      directoryUsage.touch(targetDirectoryPath);
      clearCoverPathCache();
    }

    return ok({
      cancelled: false,
      importedCount,
      renamedConflictCount,
      skipped
    });
  });

  registerHandler('organizer.deleteAuthorDirectory', async (request) => {
    const currentPath = normalizeAbsolutePath(request.directoryPath);
    if (!(await directoryExists(currentPath))) {
      return fail('NOT_FOUND', 'Author directory not found');
    }

    const libraryRootPath = getLibraryRootPath(library);
    const authorsRootPath = libraryRootPath ? getAuthorsDirectoryPath(libraryRootPath) : null;
    const parentPath = normalizeAbsolutePath(path.dirname(currentPath));
    if (!authorsRootPath || normalizeAbsolutePath(authorsRootPath) !== parentPath) {
      return fail('VALIDATION', 'Only direct author directories can be deleted');
    }

    const prefix = `${currentPath}${path.sep}`;
    const mangaCount = manga.list().filter((book) => {
      const normalizedFolderPath = normalizeAbsolutePath(book.folderPath);
      return normalizedFolderPath === currentPath || normalizedFolderPath.startsWith(prefix);
    }).length;

    if (mangaCount > 0) {
      return fail('DIRECTORY_NOT_EMPTY', '该作者目录下还有漫画，不能删除。');
    }

    const previousName = path.basename(currentPath);
    const previousKey = toKey(previousName);
    for (const aliasItem of alias.list()) {
      if (toKey(aliasItem.canonicalName) !== previousKey) {
        continue;
      }
      alias.remove(aliasItem.alias, currentPath);
    }

    await fs.rm(currentPath, { recursive: true, force: false });
    return ok({ deleted: true, path: currentPath });
  });

  registerHandler('organizer.deleteManga', async (request) => {
    const book = manga.getById(request.mangaId);
    if (!book) {
      return fail('NOT_FOUND', 'Manga not found');
    }

    if (request.withFiles) {
      await shell.trashItem(book.folderPath);
    } else {
      await fs.access(book.folderPath);
    }

    invalidateCoverPath(book.folderPath);
    const deleted = manga.deleteById(book.id);

    return ok({ deleted });
  });
}
