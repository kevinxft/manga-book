import type { IpcContext } from './context';
import { registerLibraryIpc } from './library.ipc';
import { registerOrganizerIpc } from './organizer.ipc';
import { registerReaderIpc } from './reader.ipc';
import { registerBookmarkIpc } from './bookmark.ipc';
import { registerTagIpc } from './tag.ipc';

export function registerIpcHandlers(context: IpcContext): void {
  registerLibraryIpc(context);
  registerOrganizerIpc(context);
  registerTagIpc(context);
  registerReaderIpc(context);
  registerBookmarkIpc(context);
}
