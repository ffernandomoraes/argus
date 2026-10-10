import { shell } from 'electron'
import type { Auth } from '../auth'
import { handle, on } from './register'

// Contas do Claude Code: login, contas extras e instalação do `claude`.
export function registerAuthIpc(auth: Auth): void {
  handle('auth:state', () => auth.state)
  on('auth:refresh', () => auth.refresh())
  on('auth:install', () => auth.installClaude())
  on('auth:login', (_e, accountId, method) => auth.login(accountId, method))
  on('auth:add', (_e, method) => auth.add(method))
  on('auth:code', (_e, code) => auth.submitCode(code))
  on('auth:cancel', () => auth.cancel())
  handle('auth:logout', () => auth.logout())
  handle('auth:remove', (_e, accountId) => auth.remove(accountId))
  on('auth:rename', (_e, accountId, name) => auth.rename(accountId, name))
  on('auth:setDefault', (_e, accountId) => auth.setDefault(accountId))
  // Página de login no navegador: só endereço seguro.
  on('auth:open', (_e, url) => (/^https:/.test(url) ? shell.openExternal(url) : undefined))
}
