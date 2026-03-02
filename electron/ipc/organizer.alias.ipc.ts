import type { IpcContext } from './context';
import { fail, ok, registerHandler } from './helpers';

export function registerOrganizerAliasIpc(context: IpcContext): void {
  const { alias } = context.repositories;

  registerHandler('organizer.addAlias', async (request) => {
    const inputAlias = request.alias?.trim();
    const canonicalName = request.canonicalName?.trim();

    if (!inputAlias || !canonicalName) {
      return fail('VALIDATION', 'Alias and canonical name are required');
    }

    const stored = alias.insert(inputAlias, canonicalName);
    return ok(stored);
  });

  registerHandler('organizer.listAliases', async () => {
    return ok(alias.list());
  });

  registerHandler('organizer.removeAlias', async (request) => {
    const inputAlias = request.alias?.trim();
    if (!inputAlias) {
      return fail('VALIDATION', 'Alias is required');
    }
    return ok({ removed: alias.remove(inputAlias) });
  });
}
