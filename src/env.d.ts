/// <reference types="vite/client" />

import type { IpcChannels, IpcResult } from '@shared/types';

declare global {
  interface Window {
    mangaBookApi: {
      invoke<K extends keyof IpcChannels>(
        channel: K,
        request: IpcChannels[K]['req']
      ): Promise<IpcResult<IpcChannels[K]['res']>>;
    };
  }
}

export {};
