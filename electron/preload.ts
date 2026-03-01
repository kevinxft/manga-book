import { contextBridge, ipcRenderer } from 'electron';
import type { IpcChannels, IpcResult } from '@shared/types';

const api = {
  invoke<K extends keyof IpcChannels>(
    channel: K,
    request: IpcChannels[K]['req']
  ): Promise<IpcResult<IpcChannels[K]['res']>> {
    return ipcRenderer.invoke(channel, request);
  }
};

contextBridge.exposeInMainWorld('mangaBookApi', api);
