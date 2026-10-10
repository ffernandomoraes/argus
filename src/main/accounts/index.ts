import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { MAIN_ACCOUNT } from '../../shared/auth'
import { erase } from './erase'
import { link } from './links'
import { accountDir, MAIN_DIR, ROOT } from './paths'
import { accountIds, forgetAccount, pending, resolveAccount } from './registry'
import { seed } from './seed'

// Contas do Claude no app. A principal é a do ~/.claude, a mesma do terminal e do VS Code. Cada
// outra mora numa pasta própria, passada ao `claude` em CLAUDE_CONFIG_DIR (a pasta de configuração
// do Claude Code): o .claude.json dela fica lá dentro, e o login vai para outro item das Chaves do
// macOS, "Claude Code-credentials-" mais o hash da pasta (conferido na 2.1.291; ver keychain.ts).
// No Windows o login fica num arquivo dentro da própria pasta (.credentials.json). Assim as contas
// rodam ao mesmo tempo sem uma derrubar a outra.
// O que é seu fica ligado à principal por link simbólico; o login e os MCPs, não (ver links.ts).

export { cleanupAccounts } from './erase'
export { suggestedName } from './naming'
export { accountDir } from './paths'
export {
  accountIds,
  addAccount,
  customName,
  defaultAccount,
  renameAccount,
  resolveAccount,
  setDefaultAccount
} from './registry'

// Pastas onde cada Claude Code aberto grava o status (<pasta>/sessions/<pid>.json), de todas as contas.
export function statusDirs(): string[] {
  return accountIds().map((id) => join(accountDir(id) ?? MAIN_DIR, 'sessions'))
}

// Põe a conta no ambiente do `claude` e devolve a que ficou valendo. A principal vai sem a
// variável, mesmo se o app foi aberto com ela: o resto do app lê ~/.claude.
export function applyAccount(env: Record<string, string>, id?: string): string {
  const account = resolveAccount(id)
  delete env.CLAUDE_CONFIG_DIR
  delete env.CLAUDE_SECURESTORAGE_CONFIG_DIR
  const dir = accountDir(account)
  if (dir) {
    link(dir)
    env.CLAUDE_CONFIG_DIR = dir
  }
  return account
}

// Pasta de uma conta nova, pronta para o login. Ela só entra na lista com addAccount.
export function createPendingAccount(): string {
  const id = randomUUID().replace(/-/g, '').slice(0, 8)
  const dir = join(ROOT, id)
  mkdirSync(dir, { recursive: true })
  seed(dir)
  link(dir)
  pending.add(id)
  return id
}

// Login de conta nova cancelado ou recusado: some a pasta e o login que ela tenha guardado.
export function discardAccount(id: string): void {
  pending.delete(id)
  erase(id)
}

// Tira a conta da lista e apaga a pasta. Grupos que usavam ela passam a usar a padrão.
export function removeAccount(id: string): void {
  if (id === MAIN_ACCOUNT) return
  forgetAccount(id)
  erase(id)
}
