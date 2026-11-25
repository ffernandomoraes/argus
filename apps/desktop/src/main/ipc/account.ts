import { ACCOUNT_PROVIDERS, type AccountProvider } from '@argus/shared/account';
import type { ClaudeAction } from '@argus/shared/accountClaude';
import type { AccountService } from '../account';
import { handle, on } from './register';

const ACTIONS: ClaudeAction[] = ['import', 'keepLocal', 'remove'];

// Conta do Argus (Configurações > Perfil) e as preferências da janela que sincronizam.
export function registerAccountIpc(account: AccountService): void {
  handle('account:state', () => account.state());
  handle('account:devices', () => account.devices());
  handle('account:removeDevice', (_e, id) => (typeof id === 'string' ? account.removeDevice(id) : false));
  handle('account:delete', () => account.deleteAccount());
  handle('account:computers', () => account.computers());
  handle('account:importWorkspace', (_e, computerId, boardId) =>
    typeof computerId === 'string' && typeof boardId === 'string' ? account.importWorkspace(computerId, boardId) : ({ ok: false, error: 'notFound' } as const),
  );
  handle('account:claudeItems', () => account.claudeItems());
  handle('account:claudeAct', (_e, action, keys) =>
    ACTIONS.includes(action) && Array.isArray(keys) && keys.every((k) => typeof k === 'string') ? account.claudeAct(action, keys) : null,
  );
  handle('account:github', () => account.github.status());
  handle('account:githubConnect', () => account.github.connect());
  handle('account:githubRepos', () => account.github.repos());
  handle('account:githubInstallations', () => account.github.installations());
  handle('account:githubDisconnect', () => account.github.disconnect());
  on('account:githubCancel', () => account.github.cancel());
  on('account:signIn', (_e, provider) => {
    if (ACCOUNT_PROVIDERS.includes(provider as AccountProvider)) void account.signIn(provider);
  });
  on('account:cancelSignIn', () => account.cancelSignIn());
  on('account:signOut', () => void account.signOut());
  on('account:syncNow', () => account.syncNow());
  on('account:reportPrefs', (_e, prefs) => {
    if (prefs && typeof prefs === 'object' && !Array.isArray(prefs)) account.reportPrefs(prefs);
  });
}
