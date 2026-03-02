import type { MangaBookWithCover } from '@shared/types';
import { ipcInvoke } from '@renderer/ipc/client';
import { getErrorMessage } from './error';

interface UseOrganizerSearchActionsInput {
  hasIpcBridge: boolean;
  setMoveError: (message: string | null) => void;
}

export function useOrganizerSearchActions({ hasIpcBridge, setMoveError }: UseOrganizerSearchActionsInput) {
  const handleOpenInFolder = async (mangaId: string) => {
    setMoveError(null);
    try {
      await ipcInvoke('organizer.openMangaFolder', { mangaId });
    } catch (error) {
      setMoveError(getErrorMessage(error, '打开文件夹失败'));
    }
  };

  const handleSearchWeb = async (item: MangaBookWithCover, provider: 'hitomi' | 'exhentai' | 'google') => {
    if (!hasIpcBridge) {
      setMoveError('当前运行在普通浏览器环境，无法发起搜索。请使用 bun run dev 启动 Electron 窗口。');
      return;
    }

    const query = item.title.trim();
    if (!query) {
      setMoveError('当前漫画标题为空，无法发起搜索。');
      return;
    }

    setMoveError(null);
    try {
      await ipcInvoke('organizer.searchWeb', { provider, query });
    } catch (error) {
      setMoveError(getErrorMessage(error, '打开搜索失败'));
    }
  };

  return {
    handleOpenInFolder,
    handleSearchWeb
  };
}
