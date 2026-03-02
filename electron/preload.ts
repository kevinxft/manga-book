import { contextBridge, ipcRenderer } from 'electron';
import type { IpcChannels, IpcResult, OrganizerContextMenuAction } from '@shared/types';

const api = {
  invoke<K extends keyof IpcChannels>(
    channel: K,
    request: IpcChannels[K]['req']
  ): Promise<IpcResult<IpcChannels[K]['res']>> {
    return ipcRenderer.invoke(channel, request);
  },
  onOrganizerContextAction(listener: (payload: OrganizerContextMenuAction) => void): () => void {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: OrganizerContextMenuAction) => {
      listener(payload);
    };
    ipcRenderer.on('organizer.context-menu-action', wrapped);
    return () => {
      ipcRenderer.removeListener('organizer.context-menu-action', wrapped);
    };
  }
};

contextBridge.exposeInMainWorld('mangaBookApi', api);
