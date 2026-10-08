import { execFile, spawn } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { homedir, userInfo } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { IS_MAC } from './platform'

// Login do Claude Code (o mesmo que o Agent SDK usa): nas Chaves do macOS no Mac; no Windows, o
// Claude Code guarda num arquivo, ~/.claude/.credentials.json.
// Serve para chamadas que não passam pelo SDK, como a transcrição do ditado. Renova o
// acesso como o Claude Code faz e grava o novo de volta, para o Claude Code seguir usando.

const run = promisify(execFile)
const SERVICE = 'Claude Code-credentials'
const CREDENTIALS_FILE = join(homedir(), '.claude', '.credentials.json')
const TOKEN_URL = 'https://platform.claude.com/v1/oauth/token'
const CLIENT_ID = '22422756-60c9-4084-8eb7-27705fd5cf9a'
// Renova um pouco antes de vencer, para não cair no meio de um ditado.
const MARGIN_MS = 5 * 60_000

type OAuth = {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  refreshTokenExpiresAt?: number
  scopes?: string[]
  subscriptionType?: unknown
  rateLimitTier?: unknown
}
type Stored = { claudeAiOauth?: OAuth } & Record<string, unknown>

async function read(): Promise<Stored | null> {
  try {
    if (!IS_MAC) return JSON.parse(await readFile(CREDENTIALS_FILE, 'utf8')) as Stored
    const { stdout } = await run('security', ['find-generic-password', '-a', userInfo().username, '-s', SERVICE, '-w'])
    return JSON.parse(stdout.trim()) as Stored
  } catch {
    return null
  }
}

// No Mac, pelo stdin do `security`, para o login não aparecer na lista de processos.
async function write(data: Stored): Promise<boolean> {
  if (!IS_MAC) {
    return writeFile(CREDENTIALS_FILE, JSON.stringify(data), { mode: 0o600 }).then(
      () => true,
      () => false
    )
  }
  const hex = Buffer.from(JSON.stringify(data), 'utf-8').toString('hex')
  return new Promise((resolve) => {
    const proc = spawn('security', ['-i'], { stdio: ['pipe', 'ignore', 'ignore'] })
    proc.on('error', () => resolve(false))
    proc.on('exit', (code) => resolve(code === 0))
    proc.stdin.end(`add-generic-password -U -a "${userInfo().username}" -s "${SERVICE}" -X "${hex}"\n`)
  })
}

async function refresh(current: OAuth): Promise<OAuth | null> {
  if (!current.refreshToken) return null
  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: current.refreshToken,
        client_id: CLIENT_ID,
        ...(current.scopes?.length ? { scope: current.scopes.join(' ') } : {})
      }),
      signal: AbortSignal.timeout(10_000)
    })
    if (!res.ok) return null
    const body = (await res.json()) as {
      access_token: string
      refresh_token?: string
      expires_in: number
      refresh_token_expires_in?: number
      scope?: string
    }
    const next: OAuth = {
      ...current,
      accessToken: body.access_token,
      refreshToken: body.refresh_token || current.refreshToken,
      expiresAt: Date.now() + body.expires_in * 1000,
      ...(typeof body.refresh_token_expires_in === 'number' && {
        refreshTokenExpiresAt: Date.now() + body.refresh_token_expires_in * 1000
      }),
      scopes: body.scope ? body.scope.split(' ') : current.scopes
    }
    // O Claude Code pode ter renovado ao mesmo tempo; nesse caso vale o que ele gravou.
    const stored = await read()
    if (stored?.claudeAiOauth && stored.claudeAiOauth.refreshToken !== current.refreshToken) return stored.claudeAiOauth
    await write({ ...(stored ?? {}), claudeAiOauth: next })
    return next
  } catch {
    return null
  }
}

let pending: Promise<string | null> | null = null

// Token de acesso válido, ou null sem login do Claude Code.
export function claudeAccessToken(): Promise<string | null> {
  pending ??= (async () => {
    const oauth = (await read())?.claudeAiOauth
    if (!oauth?.accessToken) return null
    if (oauth.expiresAt && Date.now() + MARGIN_MS >= oauth.expiresAt) {
      // Se renovar falhar, tenta com o que tem: o serviço responde se não valer mais.
      return (await refresh(oauth))?.accessToken ?? oauth.accessToken
    }
    return oauth.accessToken
  })().finally(() => {
    pending = null
  })
  return pending
}
