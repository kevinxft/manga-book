import { ipcMain } from 'electron';
import type { IpcChannels, IpcResult } from '@shared/types';

export function ok<T>(data: T): IpcResult<T> {
  return { ok: true, data };
}

export function fail(code: string, message: string): IpcResult<never> {
  return { ok: false, error: { code, message } };
}

export function registerHandler<K extends keyof IpcChannels>(
  channel: K,
  handler: (
    request: IpcChannels[K]['req']
  ) => Promise<IpcResult<IpcChannels[K]['res']>> | IpcResult<IpcChannels[K]['res']>
): void {
  ipcMain.handle(channel, async (_event, request) => {
    try {
      return await handler(request as IpcChannels[K]['req']);
    } catch (error) {
      return fail('UNEXPECTED', error instanceof Error ? error.message : 'Unexpected IPC error');
    }
  });
}
