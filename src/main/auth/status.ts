import { execFile } from 'node:child_process'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { Account } from '../../shared/auth'
import { accountDir } from '../accounts'
import { claudeEnv } from '../chats'
import { claudeCommand, claudePath } from '../claudePath'
import { readJsonFile } from '../lib/jsonFile'
import { parseAuthStatus, parseFailedStatus, userNameFrom } from './parseStatus'

const run = promisify(execFile)

// Comando do `claude` fora do SDK. windowsHide: sem ele, o Windows pisca uma janela de terminal a
// cada conferência de login.
export function runClaude(claude: string, args: string[], account: string) {
  const cmd = claudeCommand(args, claude)
  return run(cmd.file, cmd.args, { env: claudeEnv(claude, account), timeout: 15_000, windowsHide: true })
}

// Nome da pessoa na conta, guardado pelo Claude Code no .claude.json dela (ver userNameFrom).
function readUserName(id: string, email: string | undefined): string | undefined {
  const read = readJsonFile(join(accountDir(id) ?? homedir(), '.claude.json'))
  return read.status === 'ok' ? userNameFrom(read.data, email) : undefined
}

// ok: o `claude` respondeu (logado ou não). Falha (tempo esgotado, `claude` que não abriu): quem
// pergunta decide o que fazer com o que já sabia.
export type AccountRead = { ok: true; account: Account } | { ok: false }

export async function readAccount(id: string): Promise<AccountRead> {
  const claude = claudePath()
  try {
    const { stdout } = await runClaude(claude, ['auth', 'status', '--json'], id)
    return { ok: true, account: parseAuthStatus(stdout, (email) => readUserName(id, email)) }
  } catch (err) {
    const account = parseFailedStatus((err as { stdout?: string }).stdout)
    if (account) return { ok: true, account }
    console.warn('[auth] claude auth status falhou:', (err as Error).message)
    return { ok: false }
  }
}
