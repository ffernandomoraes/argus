import { shell } from 'electron'
import type { Auth } from '../auth'
import { isRemotePage } from './page'
import { handle, on } from './register'

// Contas do Claude Code: login, contas extras e instalação do `claude`.
export function registerAuthIpc(auth: Auth): void {
  handle('auth:state', () => auth.state)
  on('auth:refresh', () => auth.refresh())
  on('auth:install', () => auth.installClaude())
  // Pedido de uma janela de acesso remoto: o navegador daqui não abre (ninguém está na frente
  // deste computador); a janela de lá abre a página do código no navegador dela e cola o código.
  on('auth:login', (e, accountId, method, distro) => auth.login(accountId, method, distro, { openBrowser: !isRemotePage(e.sender) }))
  on('auth:add', (e, method) => auth.add(method, { openBrowser: !isRemotePage(e.sender) }))
  on('auth:code', (_e, code) => auth.submitCode(code))
  on('auth:cancel', () => auth.cancel())
  handle('auth:logout', () => auth.logout())
  handle('auth:remove', (_e, accountId) => auth.remove(accountId))
  on('auth:rename', (_e, accountId, name) => auth.rename(accountId, name))
  on('auth:setDefault', (_e, accountId) => auth.setDefault(accountId))
  on('auth:dismissMergeNotice', () => auth.dismissMergeNotice())
  // Página de login no navegador: só endereço seguro.
  on('auth:open', (_e, url) => (/^https:/.test(url) ? shell.openExternal(url) : undefined))
}
