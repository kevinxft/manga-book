import fs from 'node:fs/promises';
import path from 'node:path';
import type { DirectoryAlias } from '@shared/types';
import type { IpcContext } from './context';
import { fail, ok, registerHandler } from './helpers';
import { listArtistsRoots } from './organizer.common';
import { listDirectories, pathExists } from '@main/utils/fsUtils';
import { normalizeAbsolutePath, toKey } from '@main/utils/pathUtils';

const AUTHOR_ALIAS_METADATA_FILENAME = '.mangabook-author.json';

interface AuthorAliasMetadata {
  canonicalName: string;
  aliases: string[];
  updatedAt: string;
}

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

async function listFileBackedAliases(context: IpcContext): Promise<DirectoryAlias[]> {
  const roots = await listArtistsRoots(context.repositories.library);
  const aliases: DirectoryAlias[] = [];

  for (const rootPath of roots) {
    const authorDirectories = await listDirectories(rootPath).catch(() => [] as string[]);
    for (const directoryPath of authorDirectories) {
      const normalizedDirectoryPath = normalizeAbsolutePath(directoryPath);
      const metadata = await readAuthorAliasMetadata(normalizedDirectoryPath);
      if (!metadata) {
        continue;
      }

      for (const aliasName of metadata.aliases) {
        const aliasKey = toKey(aliasName);
        if (!aliasKey) {
          continue;
        }
        aliases.push({
          id: `file:${toKey(normalizedDirectoryPath)}:${aliasKey}`,
          alias: aliasName,
          canonicalName: metadata.canonicalName,
          createdAt: metadata.updatedAt
        });
      }
    }
  }

  return aliases;
}

async function syncDbAliasesToAuthorFiles(context: IpcContext, dbAliases: DirectoryAlias[]): Promise<void> {
  if (dbAliases.length === 0) {
    return;
  }

  const roots = await listArtistsRoots(context.repositories.library);
  const directoryPathByCanonicalKey = new Map<string, string>();

  for (const rootPath of roots) {
    const authorDirectories = await listDirectories(rootPath).catch(() => [] as string[]);
    for (const directoryPath of authorDirectories) {
      const normalizedDirectoryPath = normalizeAbsolutePath(directoryPath);
      const canonicalKey = toKey(path.basename(normalizedDirectoryPath));
      if (!canonicalKey || directoryPathByCanonicalKey.has(canonicalKey)) {
        continue;
      }
      directoryPathByCanonicalKey.set(canonicalKey, normalizedDirectoryPath);
    }
  }

  const aliasesByCanonicalKey = new Map<string, DirectoryAlias[]>();
  for (const item of dbAliases) {
    const canonicalKey = toKey(item.canonicalName);
    if (!canonicalKey) {
      continue;
    }
    const current = aliasesByCanonicalKey.get(canonicalKey) ?? [];
    current.push(item);
    aliasesByCanonicalKey.set(canonicalKey, current);
  }

  for (const [canonicalKey, items] of aliasesByCanonicalKey) {
    const directoryPath = directoryPathByCanonicalKey.get(canonicalKey);
    if (!directoryPath) {
      continue;
    }

    const metadata = await readAuthorAliasMetadata(directoryPath);
    const canonicalName = items[0]?.canonicalName ?? metadata?.canonicalName ?? path.basename(directoryPath);
    const nextAliases = new Set([...(metadata?.aliases ?? [])]);
    for (const item of items) {
      nextAliases.add(item.alias);
    }

    await writeAuthorAliasMetadata(directoryPath, canonicalName, Array.from(nextAliases));
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

    const stored = alias.insert(inputAlias, canonicalName);
    if (canonicalPath) {
      const metadata = await readAuthorAliasMetadata(canonicalPath);
      const nextAliases = [...(metadata?.aliases ?? []), inputAlias];
      await writeAuthorAliasMetadata(canonicalPath, canonicalName, nextAliases);
    }
    return ok(stored);
  });

  registerHandler('organizer.listAliases', async () => {
    const dbAliases = alias.list();
    await syncDbAliasesToAuthorFiles(context, dbAliases);
    const combined = new Map<string, DirectoryAlias>();

    for (const item of dbAliases) {
      combined.set(toKey(item.alias), item);
    }

    for (const item of await listFileBackedAliases(context)) {
      combined.set(toKey(item.alias), item);
    }

    return ok(
      Array.from(combined.values()).sort((a, b) => a.alias.localeCompare(b.alias, 'zh-Hans-CN'))
    );
  });

  registerHandler('organizer.removeAlias', async (request) => {
    const inputAlias = request.alias?.trim();
    const canonicalPath = request.canonicalPath?.trim();
    if (!inputAlias) {
      return fail('VALIDATION', 'Alias is required');
    }

    const removed = alias.remove(inputAlias);

    if (canonicalPath) {
      const metadata = await readAuthorAliasMetadata(canonicalPath);
      if (metadata) {
        const nextAliases = metadata.aliases.filter((item) => toKey(item) !== toKey(inputAlias));
        await writeAuthorAliasMetadata(canonicalPath, metadata.canonicalName, nextAliases);
      }
    }

    return ok({ removed });
  });
}
