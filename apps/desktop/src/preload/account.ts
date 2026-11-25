import type { Api } from '@argus/shared/api';
import { invoke, listen, send } from './ipc';

// window.api.account: a conta do Argus e as preferências sincronizadas (canais em
// packages/shared/src/account.ts).
export const accountApi: Api['account'] = {
  state: () => invoke('account:state'),
  onState: (cb) => listen('account:state', cb),
  signIn: (provider) => send('account:signIn', provider),
  cancelSignIn: () => send('account:cancelSignIn'),
  signOut: () => send('account:signOut'),
  syncNow: () => send('account:syncNow'),
  devices: () => invoke('account:devices'),
  removeDevice: (id) => invoke('account:removeDevice', id),
  deleteAccount: () => invoke('account:delete'),
  reportPrefs: (prefs) => send('account:reportPrefs', prefs),
  onApplyPrefs: (cb) => listen('account:applyPrefs', cb),
  computers: () => invoke('account:computers'),
  importWorkspace: (computerId, boardId) => invoke('account:importWorkspace', computerId, boardId),
  claudeItems: () => invoke('account:claudeItems'),
  claudeAct: (action, keys) => invoke('account:claudeAct', action, keys),
  github: () => invoke('account:github'),
  githubConnect: () => invoke('account:githubConnect'),
  githubCancel: () => send('account:githubCancel'),
  githubRepos: () => invoke('account:githubRepos'),
  githubInstallations: () => invoke('account:githubInstallations'),
  githubDisconnect: () => invoke('account:githubDisconnect'),
};
