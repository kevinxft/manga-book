import fs from 'node:fs/promises';
import path from 'node:path';
import { shell } from 'electron';
import type { IpcContext } from './context';
import { registerHandler, ok, fail } from './helpers';
import { directoryExists, ensureDirectory, listDirectories, movePath } from '@main/utils/fsUtils';
import { normalizeAbsolutePath } from '@main/utils/pathUtils';
import { invalidateCoverPath } from '@main/scanner/coverFinder';

function normalizeDirectoryName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isArtistsDirectoryName(name: string): boolean {
  const normalized = normalizeDirectoryName(name);
  return normalized === 'artists' || normalized === 'artist';
}

function resolveSourceFolderPath(nextFolderPath: string, availableSourcePaths: string[], fallback: string): string {
  const normalizedNextPath = normalizeAbsolutePath(nextFolderPath);
  const candidates = availableSourcePaths
    .map((value) => normalizeAbsolutePath(value))
    .sort((a, b) => b.length - a.length);

  for (const sourcePath of candidates) {
    if (normalizedNextPath === sourcePath || normalizedNextPath.startsWith(`${sourcePath}${path.sep}`)) {
      return sourcePath;
    }
  }

  return normalizeAbsolutePath(fallback);
}

export function registerOrganizerIpc(context: IpcContext): void {
  const { manga, alias, library } = context.repositories;

  const listArtistsRoots = async (): Promise<string[]> => {
    const roots: string[] = [];
    const sourceFolders = library.list();

    for (const source of sourceFolders) {
      const sourcePath = normalizeAbsolutePath(source.path);
      const sourceBaseName = path.basename(sourcePath);

      if (isArtistsDirectoryName(sourceBaseName)) {
        roots.push(sourcePath);
        continue;
      }

      try {
        const children = await listDirectories(sourcePath);
        const artistFolder = children.find((childPath) => isArtistsDirectoryName(path.basename(childPath)));
        if (artistFolder) {
          roots.push(normalizeAbsolutePath(artistFolder));
        }
      } catch {
        // ignore unreadable source path
      }
    }

    return Array.from(new Set(roots));
  };

  registerHandler('organizer.moveManga', async (request) => {
    const book = manga.getById(request.mangaId);
    if (!book) {
      return fail('NOT_FOUND', 'Manga not found');
    }

    const destinationRoot = normalizeAbsolutePath(request.destinationPath);
    await ensureDirectory(destinationRoot);

    const nextFolderPath = path.join(destinationRoot, path.basename(book.folderPath));
    await movePath(book.folderPath, nextFolderPath);

    const sourcePaths = library.list().map((source) => source.path);
    const nextSourceFolderPath = resolveSourceFolderPath(nextFolderPath, sourcePaths, book.sourceFolderPath);

    invalidateCoverPath(book.folderPath);
    const updated = manga.updatePath(book.id, path.basename(nextFolderPath), nextFolderPath, nextSourceFolderPath);

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

    const sourcePaths = library.list().map((source) => source.path);
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

  registerHandler('organizer.addAlias', async (request) => {
    const inputAlias = request.alias?.trim();
    const canonicalName = request.canonicalName?.trim();

    if (!inputAlias || !canonicalName) {
      return fail('VALIDATION', 'Alias and canonical name are required');
    }

    const stored = alias.insert(inputAlias, canonicalName);
    return ok(stored);
  });

  registerHandler('organizer.listAliases', async () => {
    return ok(alias.list());
  });

  registerHandler('organizer.removeAlias', async (request) => {
    const inputAlias = request.alias?.trim();
    if (!inputAlias) {
      return fail('VALIDATION', 'Alias is required');
    }
    return ok({ removed: alias.remove(inputAlias) });
  });

  registerHandler('organizer.listAuthorDirectories', async () => {
    const artistsRoots = await listArtistsRoots();
    const directories: string[] = [];

    for (const rootPath of artistsRoots) {
      if (!(await directoryExists(rootPath))) {
        continue;
      }
      const children = await listDirectories(rootPath);
      for (const childPath of children) {
        directories.push(normalizeAbsolutePath(childPath));
      }
    }

    const mangaBooks = manga.list();
    const uniqueDirectories = Array.from(new Set(directories)).sort((a, b) => a.localeCompare(b));
    const summaries = uniqueDirectories.map((directory) => {
      const normalizedDirectory = normalizeAbsolutePath(directory);
      const prefix = `${normalizedDirectory}${path.sep}`;
      const mangaCount = mangaBooks.filter((book) => book.folderPath.startsWith(prefix)).length;
      return {
        directory: normalizedDirectory,
        mangaCount
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

    const artistsRoots = await listArtistsRoots();
    if (artistsRoots.length === 0) {
      return fail('NO_TARGET_ROOT', 'No Artists root found. Please import organizer root first.');
    }

    let targetRoot = artistsRoots[0] as string;
    const preferredBasePath = request.basePath?.trim();
    if (preferredBasePath) {
      const normalizedBasePath = normalizeAbsolutePath(preferredBasePath);
      const normalizedBaseParent = normalizeAbsolutePath(path.dirname(normalizedBasePath));
      const matchedRoot = artistsRoots.find(
        (rootPath) => rootPath === normalizedBasePath || rootPath === normalizedBaseParent
      );
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

  registerHandler('organizer.deleteManga', async (request) => {
    const book = manga.getById(request.mangaId);
    if (!book) {
      return fail('NOT_FOUND', 'Manga not found');
    }

    if (request.withFiles) {
      await fs.rm(book.folderPath, { recursive: true, force: false });
    } else {
      await fs.access(book.folderPath);
    }

    invalidateCoverPath(book.folderPath);
    const deleted = manga.deleteById(book.id);

    return ok({ deleted });
  });

  registerHandler('organizer.searchGoogle', async (request) => {
    const query = request.query?.trim();
    if (!query) {
      return fail('VALIDATION', 'Search query is required');
    }
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    await shell.openExternal(url);
    return ok({ opened: true });
  });

  registerHandler('organizer.searchWeb', async (request) => {
    const query = request.query?.trim();
    if (!query) {
      return fail('VALIDATION', 'Search query is required');
    }

    const provider = request.provider;
    let url: string;
    if (provider === 'hitomi') {
      url = `https://hitomi.la/search.html?${encodeURIComponent(query)}`;
    } else if (provider === 'exhentai') {
      url = `https://exhentai.org/?f_search=${encodeURIComponent(query)}`;
    } else {
      url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    }

    await shell.openExternal(url);
    return ok({ opened: true });
  });
}
