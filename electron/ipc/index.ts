import type { IpcContext } from './context';
import { registerLibraryIpc } from './library.ipc';
import { registerOrganizerIpc } from './organizer.ipc';
import { registerReaderIpc } from './reader.ipc';
import { registerBookmarkIpc } from './bookmark.ipc';

export function registerIpcHandlers(context: IpcContext): void {
  registerLibraryIpc(context);
  registerOrganizerIpc(context);
  registerReaderIpc(context);
  registerBookmarkIpc(context);
}
