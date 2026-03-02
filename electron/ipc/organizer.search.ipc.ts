import { shell } from 'electron';
import type { IpcContext } from './context';
import { fail, ok, registerHandler } from './helpers';

function buildSearchUrl(provider: 'hitomi' | 'exhentai' | 'google', query: string): string {
  if (provider === 'hitomi') {
    return `https://hitomi.la/search.html?${encodeURIComponent(query)}`;
  }
  if (provider === 'exhentai') {
    return `https://exhentai.org/?f_search=${encodeURIComponent(query)}`;
  }
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

export function registerOrganizerSearchIpc(_context: IpcContext): void {
  void _context;

  registerHandler('organizer.searchGoogle', async (request) => {
    const query = request.query?.trim();
    if (!query) {
      return fail('VALIDATION', 'Search query is required');
    }
    await shell.openExternal(buildSearchUrl('google', query));
    return ok({ opened: true });
  });

  registerHandler('organizer.searchWeb', async (request) => {
    const query = request.query?.trim();
    if (!query) {
      return fail('VALIDATION', 'Search query is required');
    }
    await shell.openExternal(buildSearchUrl(request.provider, query));
    return ok({ opened: true });
  });
}
