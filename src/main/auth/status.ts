import { join } from 'node:path'
import type { Account } from '../../shared/auth'
import { claudeLaunch } from '../chats'
import { runGently } from '../lib/childProcess'
import { readJsonFile } from '../lib/jsonFile'
import { claudeJsonDir } from '../claudeHome'
import { distroFor } from '../wsl'
import { emailFrom, parseAuthStatus, parseFailedStatus, userNameFrom } from './parseStatus'

// Comando do `claude` fora do SDK, sem janela de terminal no Windows. No WSL o prazo é maior: o
// primeiro wsl.exe liga a máquina virtual. Passado o prazo, para de esperar mas não mata na hora: um
// `claude` morto no meio de uma renovação levava o login junto (ver closeGently).
export async function runClaude(args: string[], account: string) {
  const l = await claudeLaunch(args, account)
  if (!l.ok) throw new Error(l.error)
  return runGently(l.file, l.args, { env: l.env, cwd: l.cwd, timeoutMs: distroFor() ? 30_000 : 15_000, graceMs: 30_000 })
}

// Nome da pessoa na conta, guardado pelo Claude Code no .claude.json dela (ver userNameFrom).
function readUserName(id: string, email: string | undefined): string | undefined {
  const read = readJsonFile(join(claudeJsonDir(id), '.claude.json'))
  return read.status === 'ok' ? userNameFrom(read.data, email) : undefined
}

// E-mail do login atual da conta, lido do .claude.json dela. undefined se não deu para ler.
export function configEmail(id: string): string | undefined {
  const read = readJsonFile(join(claudeJsonDir(id), '.claude.json'))
  return read.status === 'ok' ? emailFrom(read.data) : undefined
}

// ok: o `claude` respondeu (logado ou não). Falha (tempo esgotado, `claude` que não abriu): quem
// pergunta decide o que fazer com o que já sabia.
export type AccountRead = { ok: true; account: Account } | { ok: false }

export async function readAccount(id: string): Promise<AccountRead> {
  try {
    const { stdout } = await runClaude(['auth', 'status', '--json'], id)
    return { ok: true, account: parseAuthStatus(stdout, (email) => readUserName(id, email)) }
  } catch (err) {
    const account = parseFailedStatus((err as { stdout?: string }).stdout)
    if (account) return { ok: true, account }
    console.warn('[auth] claude auth status falhou:', (err as Error).message)
    return { ok: false }
  }
}
