import { execFile } from 'node:child_process'
import { existsSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { errorMessage } from '../lib/errors'
import { readJsonFile } from '../lib/jsonFile'
import { IS_MAC } from '../platform'
import { keychainService } from './keychain'
import { unlinkShared } from './links'
import { accountDir, ID, ROOT } from './paths'
import { pending, reg, registryReadable } from './registry'

// Apaga a pasta da conta e o login guardado dela.
export function erase(id: string): void {
  const dir = accountDir(id)
  if (!dir || !ID.test(id)) return
  // No Mac o login fica nas Chaves, fora da pasta. Cobre o caso de o `claude auth logout` ter
  // falhado ou nem ter rodado. No Windows ele mora num arquivo da pasta e sai junto com ela.
  if (IS_MAC) execFile('security', ['delete-generic-password', '-s', keychainService(dir)], () => {})
  if (unlinkShared(dir)) removeDir(dir)
}

// O `force` do rmSync só ignora a pasta que não existe. No Windows, um arquivo ainda aberto (o
// `claude` da conta fechando, o antivírus) faz ele falhar: tenta de novo algumas vezes e, se não
// sair, a pasta fica, sem derrubar quem chamou (a abertura do app, o cancelar do login).
function removeDir(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 })
  } catch (err) {
    console.warn('[accounts] não deu para apagar a pasta da conta:', dir, errorMessage(err))
  }
}

// A pasta tem um login concluído? Depois de entrar, o Claude Code grava a conta no .claude.json da
// pasta (oauthAccount, ou primaryApiKey no login por chave); no Windows, o login fica no
// .credentials.json. Na dúvida (arquivo ilegível), conta como sim.
function hasLogin(dir: string): boolean {
  if (existsSync(join(dir, '.credentials.json'))) return true
  const config = readJsonFile(join(dir, '.claude.json'))
  if (config.status === 'corrupt') return true
  if (config.status !== 'ok' || !config.data || typeof config.data !== 'object') return false
  return 'oauthAccount' in config.data || 'primaryApiKey' in config.data
}

// Pastas que sobraram de um login de conta nova interrompido (o app fechou no meio, por exemplo).
// Só as que nunca chegaram a entrar: uma pasta com login fora da lista é de uma conta que o
// accounts.json perdeu, e apagar levaria o login junto. Com o accounts.json ilegível nesta
// abertura, não apaga nada.
export function cleanupAccounts(): void {
  if (!registryReadable()) return
  let names: string[]
  try {
    names = readdirSync(ROOT)
  } catch {
    return
  }
  const known = new Set(reg().accounts)
  for (const id of names) {
    if (!ID.test(id) || known.has(id) || pending.has(id)) continue
    const dir = join(ROOT, id)
    if (hasLogin(dir)) console.warn('[accounts] pasta de conta fora da lista, com login; fica:', dir)
    else erase(id)
  }
}
