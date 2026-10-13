import { execFile } from 'node:child_process'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { Account } from '../../shared/auth'
import { claudeLaunch } from '../chats'
import { readJsonFile } from '../lib/jsonFile'
import { claudeJsonDir } from '../claudeHome'
import { distroFor } from '../wsl'
import { parseAuthStatus, parseFailedStatus, userNameFrom } from './parseStatus'

const run = promisify(execFile)

// Comando do `claude` fora do SDK. windowsHide: sem ele, o Windows pisca uma janela de terminal a
// cada conferência de login. No WSL o prazo é maior: o primeiro wsl.exe liga a máquina virtual.
export async function runClaude(args: string[], account: string) {
  const l = await claudeLaunch(args, account)
  if (!l.ok) throw new Error(l.error)
  return run(l.file, l.args, { env: l.env, cwd: l.cwd, timeout: distroFor() ? 30_000 : 15_000, windowsHide: true })
}

// Nome da pessoa na conta, guardado pelo Claude Code no .claude.json dela (ver userNameFrom).
function readUserName(id: string, email: string | undefined): string | undefined {
  const read = readJsonFile(join(claudeJsonDir(id), '.claude.json'))
  return read.status === 'ok' ? userNameFrom(read.data, email) : undefined
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
