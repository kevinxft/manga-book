import type { IpcContext } from './context';
import { registerOrganizerAliasIpc } from './organizer.alias.ipc';
import { registerOrganizerFileIpc } from './organizer.file.ipc';
import { registerOrganizerSearchIpc } from './organizer.search.ipc';

export function registerOrganizerIpc(context: IpcContext): void {
  registerOrganizerFileIpc(context);
  registerOrganizerAliasIpc(context);
  registerOrganizerSearchIpc(context);
}
