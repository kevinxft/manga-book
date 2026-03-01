import type { IpcChannels } from '@shared/types';

export async function ipcInvoke<K extends keyof IpcChannels>(
  channel: K,
  request: IpcChannels[K]['req']
): Promise<IpcChannels[K]['res']> {
  const bridge = window.mangaBookApi;
  if (!bridge || typeof bridge.invoke !== 'function') {
    throw new Error('IPC bridge is unavailable. Please run the app through Electron, not a plain browser tab.');
  }

  const result = await bridge.invoke(channel, request);
  if (!result.ok) {
    throw new Error(`[${result.error.code}] ${result.error.message}`);
  }
  return result.data;
}
