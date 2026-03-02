import type { IpcContext } from './context';
import { fail, ok, registerHandler } from './helpers';

export function registerTagIpc(context: IpcContext): void {
  const { manga, tag } = context.repositories;

  registerHandler('tag.list', async () => {
    return ok(tag.list());
  });

  registerHandler('tag.upsert', async (request) => {
    const name = request.name?.trim();
    if (!name) {
      return fail('VALIDATION', 'Tag name is required');
    }

    const created = tag.upsert(name);
    return ok(created);
  });

  registerHandler('tag.delete', async (request) => {
    const id = request.id?.trim();
    if (!id) {
      return fail('VALIDATION', 'Tag id is required');
    }
    return ok({ deleted: tag.removeById(id) });
  });

  registerHandler('tag.addToManga', async (request) => {
    const book = manga.getById(request.mangaId);
    if (!book) {
      return fail('NOT_FOUND', 'Manga not found');
    }

    const name = request.tagName?.trim();
    if (!name) {
      return fail('VALIDATION', 'Tag name is required');
    }

    const added = tag.addToManga(request.mangaId, name);
    return ok(added);
  });

  registerHandler('tag.setForManga', async (request) => {
    const book = manga.getById(request.mangaId);
    if (!book) {
      return fail('NOT_FOUND', 'Manga not found');
    }

    const tagNames = Array.isArray(request.tagNames) ? request.tagNames : [];
    const updatedTags = tag.setForManga(request.mangaId, tagNames);
    return ok(updatedTags);
  });

  registerHandler('tag.removeFromManga', async (request) => {
    const book = manga.getById(request.mangaId);
    if (!book) {
      return fail('NOT_FOUND', 'Manga not found');
    }

    const name = request.tagName?.trim();
    if (!name) {
      return fail('VALIDATION', 'Tag name is required');
    }

    const removed = tag.removeFromManga(request.mangaId, name);
    return ok({ removed });
  });
}
