import type { IpcContext } from './context';
import { registerHandler, ok } from './helpers';

export function registerBookmarkIpc(context: IpcContext): void {
  const { bookmark } = context.repositories;

  registerHandler('bookmark.create', (request) => {
    const created = bookmark.insert(request);
    return ok(created);
  });

  registerHandler('bookmark.update', (request) => {
    const updated = bookmark.update(request.id, request.title, request.note);
    return ok(updated);
  });

  registerHandler('bookmark.delete', (request) => {
    const deleted = bookmark.remove(request.id);
    return ok({ deleted });
  });

  registerHandler('bookmark.listByManga', (request) => {
    const items = bookmark.listByManga(request.mangaId);
    return ok(items);
  });
}
