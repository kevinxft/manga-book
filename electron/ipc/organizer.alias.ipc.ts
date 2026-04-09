import fs from 'node:fs/promises';
import path from 'node:path';
import type { DirectoryAlias } from '@shared/types';
import type { IpcContext } from './context';
import { fail, ok, registerHandler } from './helpers';
import { pathExists } from '@main/utils/fsUtils';
import { normalizeAbsolutePath, toKey } from '@main/utils/pathUtils';

const AUTHOR_ALIAS_METADATA_FILENAME = '.mangabook-author.json';

interface AuthorAliasMetadata {
  canonicalName: string;
  aliases: string[];
  updatedAt: string;
}

let cachedAliases: DirectoryAlias[] | null = null;
let cachedAliasesPromise: Promise<DirectoryAlias[]> | null = null;

function getAuthorAliasMetadataPath(directoryPath: string): string {
  return path.join(normalizeAbsolutePath(directoryPath), AUTHOR_ALIAS_METADATA_FILENAME);
}

export async function readAuthorAliasMetadata(directoryPath: string): Promise<AuthorAliasMetadata | null> {
  const metadataPath = getAuthorAliasMetadataPath(directoryPath);
  if (!(await pathExists(metadataPath))) {
    return null;
  }

  try {
    const raw = await fs.readFile(metadataPath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<AuthorAliasMetadata>;
    const aliases = Array.isArray(parsed.aliases)
      ? parsed.aliases.map((item) => String(item).trim()).filter((item) => item.length > 0)
      : [];
    const canonicalName = String(parsed.canonicalName ?? '').trim() || path.basename(directoryPath);
    return {
      canonicalName,
      aliases: Array.from(new Set(aliases)),
      updatedAt: String(parsed.updatedAt ?? '') || new Date().toISOString()
    };
  } catch {
    return null;
  }
}

export async function writeAuthorAliasMetadata(directoryPath: string, canonicalName: string, aliases: string[]): Promise<void> {
  const metadataPath = getAuthorAliasMetadataPath(directoryPath);
  const nextAliases = Array.from(new Set(aliases.map((item) => item.trim()).filter((item) => item.length > 0)));

  if (nextAliases.length === 0) {
    try {
      await fs.rm(metadataPath, { force: true });
    } catch {
      // ignore cleanup errors
    }
    return;
  }

  const payload: AuthorAliasMetadata = {
    canonicalName: canonicalName.trim() || path.basename(directoryPath),
    aliases: nextAliases,
    updatedAt: new Date().toISOString()
  };

  await fs.writeFile(metadataPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function sortAliases(items: DirectoryAlias[]): DirectoryAlias[] {
  return [...items].sort((a, b) => a.alias.localeCompare(b.alias, 'zh-Hans-CN'));
}

export function invalidateAliasListCache(): void {
  cachedAliases = null;
  cachedAliasesPromise = null;
}

export function updateCachedAlias(storedAlias: DirectoryAlias): void {
  if (!cachedAliases) {
    return;
  }

  const next = cachedAliases.filter((item) => toKey(item.alias) !== toKey(storedAlias.alias));
  next.push(storedAlias);
  cachedAliases = sortAliases(next);
}

export function removeCachedAlias(aliasName: string): void {
  if (!cachedAliases) {
    return;
  }

  cachedAliases = cachedAliases.filter((item) => toKey(item.alias) !== toKey(aliasName));
}

export function updateCachedCanonicalName(previousName: string, nextName: string): void {
  if (!cachedAliases) {
    return;
  }

  const previousKey = toKey(previousName);
  cachedAliases = cachedAliases.map((item) =>
    toKey(item.canonicalName) === previousKey ? { ...item, canonicalName: nextName } : item
  );
}

async function loadAliases(context: IpcContext, force = false): Promise<DirectoryAlias[]> {
  if (!force && cachedAliases) {
    return cachedAliases;
  }

  if (!force && cachedAliasesPromise) {
    return cachedAliasesPromise;
  }

  cachedAliasesPromise = (async () => {
    const nextAliases = sortAliases(context.repositories.alias.list());
    cachedAliases = nextAliases;
    cachedAliasesPromise = null;
    return nextAliases;
  })();

  try {
    return await cachedAliasesPromise;
  } catch (error) {
    cachedAliasesPromise = null;
    throw error;
  }
}

export function registerOrganizerAliasIpc(context: IpcContext): void {
  const { alias } = context.repositories;

  registerHandler('organizer.addAlias', async (request) => {
    const inputAlias = request.alias?.trim();
    const canonicalName = request.canonicalName?.trim();
    const canonicalPath = request.canonicalPath?.trim();

    if (!inputAlias || !canonicalName) {
      return fail('VALIDATION', 'Alias and canonical name are required');
    }

    const stored = alias.insert(inputAlias, canonicalName, canonicalPath);
    updateCachedAlias(stored);
    return ok(stored);
  });

  registerHandler('organizer.listAliases', async (request) => {
    return ok(await loadAliases(context, request?.force ?? false));
  });

  registerHandler('organizer.removeAlias', async (request) => {
    const inputAlias = request.alias?.trim();
    const canonicalPath = request.canonicalPath?.trim();
    if (!inputAlias) {
      return fail('VALIDATION', 'Alias is required');
    }

    const removed = alias.remove(inputAlias, canonicalPath);

    removeCachedAlias(inputAlias);
    return ok({ removed });
  });
}
