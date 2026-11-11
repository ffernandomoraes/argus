import { join } from 'node:path'
import type { Account } from '../../shared/auth'
import { claudeLaunch } from '../chats'
import { runGently } from '../lib/childProcess'
import { readJsonFileAsync } from '../lib/jsonFile'
import { claudeJsonDir } from '../claudeHome'
import { distroFor } from '../wsl'
import { emailFrom, parseAuthStatus, parseFailedStatus, userNameFrom } from './parseStatus'

// Comando do `claude` fora do SDK, sem janela de terminal no Windows. No WSL o prazo é maior: o
// primeiro wsl.exe liga a máquina virtual. Passado o prazo, para de esperar mas não mata na hora: um
// `claude` morto no meio de uma renovação levava o login junto (ver closeGently).
// place: uma pasta do WSL, para rodar o `claude` daquela distro (ver wslPlace.ts); sem ela, o do app.
export async function runClaude(args: string[], account: string, place?: string) {
  const l = await claudeLaunch(args, account, place)
  if (!l.ok) throw new Error(l.error)
  return runGently(l.file, l.args, { env: l.env, cwd: l.cwd, timeoutMs: distroFor(place) ? 30_000 : 15_000, graceMs: 30_000 })
}

// O .claude.json da conta, sem segurar o app: com o Claude só no WSL, o arquivo está lá, e a máquina
// virtual ainda desligada (ou lenta) segurava o app inteiro enquanto respondia.
const readConfig = (id: string, place?: string) => readJsonFileAsync(join(claudeJsonDir(id, place), '.claude.json'))

// E-mail do login atual da conta, lido do .claude.json dela. undefined se não deu para ler.
export async function configEmail(id: string): Promise<string | undefined> {
  const read = await readConfig(id)
  return read.status === 'ok' ? emailFrom(read.data) : undefined
}

// ok: o `claude` respondeu (logado ou não). Falha (tempo esgotado, `claude` que não abriu): quem
// pergunta decide o que fazer com o que já sabia.
export type AccountRead = { ok: true; account: Account } | { ok: false }

export async function readAccount(id: string, place?: string): Promise<AccountRead> {
  try {
    const { stdout } = await runClaude(['auth', 'status', '--json'], id, place)
    // Nome da pessoa, guardado pelo Claude Code no .claude.json dela (ver userNameFrom).
    const config = await readConfig(id, place)
    return { ok: true, account: parseAuthStatus(stdout, (email) => (config.status === 'ok' ? userNameFrom(config.data, email) : undefined)) }
  } catch (err) {
    const account = parseFailedStatus((err as { stdout?: string }).stdout)
    if (account) return { ok: true, account }
    console.warn('[auth] claude auth status falhou:', (err as Error).message)
    return { ok: false }
  }
}
