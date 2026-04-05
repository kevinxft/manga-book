import type { MangaBookWithCover } from '@shared/types';
import { ipcInvoke } from '@renderer/ipc/client';

interface UseMangaSearchActionsInput {
  hasIpcBridge: boolean;
  setError: (message: string | null) => void;
}

export function useMangaSearchActions({ hasIpcBridge, setError }: UseMangaSearchActionsInput) {
  const handleOpenInFolder = async (mangaId: string) => {
    setError(null);
    try {
      await ipcInvoke('organizer.openMangaFolder', { mangaId });
    } catch (error) {
      setError(error instanceof Error ? error.message : '打开文件夹失败');
    }
  };

  const handleSearchWeb = async (item: MangaBookWithCover, provider: 'hitomi' | 'exhentai' | 'google') => {
    if (!hasIpcBridge) {
      setError('当前运行在普通浏览器环境，无法发起搜索。请使用 bun run dev 启动 Electron 窗口。');
      return;
    }

    const query = item.title.trim();
    if (!query) {
      setError('当前漫画标题为空，无法发起搜索。');
      return;
    }

    setError(null);
    try {
      await ipcInvoke('organizer.searchWeb', { provider, query });
    } catch (error) {
      setError(error instanceof Error ? error.message : '打开搜索失败');
    }
  };

  return {
    handleOpenInFolder,
    handleSearchWeb
  };
}
