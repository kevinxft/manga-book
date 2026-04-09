import { contextBridge, ipcRenderer } from 'electron';
import type { IpcChannels, IpcResult, ScanTaskEvent } from '@shared/types';

const api = {
  invoke<K extends keyof IpcChannels>(
    channel: K,
    request: IpcChannels[K]['req']
  ): Promise<IpcResult<IpcChannels[K]['res']>> {
    return ipcRenderer.invoke(channel, request);
  },
  onScanProgress(listener: (payload: ScanTaskEvent) => void): () => void {
    const handler = (_event: Electron.IpcRendererEvent, payload: ScanTaskEvent) => {
      listener(payload);
    };

    ipcRenderer.on('library:scan-progress', handler);
    return () => {
      ipcRenderer.removeListener('library:scan-progress', handler);
    };
  }
};

contextBridge.exposeInMainWorld('mangaBookApi', api);
