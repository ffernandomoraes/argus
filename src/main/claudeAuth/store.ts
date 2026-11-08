import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { accountDir } from '../accounts'
import { keychainAccount, keychainService } from '../accounts/keychain'
import { configDir } from '../claudeHome'
import { IS_MAC } from '../platform'

// Onde o Claude Code guarda o login de cada conta: nas Chaves do macOS no Mac (um item por pasta
// de configuração, ver accounts/keychain.ts); no Windows, no .credentials.json da pasta da conta
// (o da principal em ~/.claude).

export type OAuth = {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  refreshTokenExpiresAt?: number
  scopes?: string[]
  subscriptionType?: unknown
  rateLimitTier?: unknown
  // Gravado pelo Claude Code ao apagar o login (ver loginState): "time_limit" quando venceu o prazo.
  loginEnded?: string
}
// O item guarda mais que o login do Claude (os logins dos MCPs, por exemplo). O Argus só lê: quem
// grava é o Claude Code (ver renew.ts).
export type Stored = { claudeAiOauth?: OAuth } & Record<string, unknown>

const run = promisify(execFile)

// Do Claude Code do app: no Windows sem o `claude` de lá, o do WSL (ver claudeHome.ts).
const credentialsFile = (account: string) => join(configDir(account), '.credentials.json')

// Como estava o login lido. ok: com acesso. ended: o Claude Code apagou o login depois de a
// renovação ser recusada (refreshToken e accessToken vazios, expiresAt 0; conferido no binário da
// 2.1.319), e só volta entrando de novo. empty: guardado, sem login do Claude (chave de API). missing:
// nada guardado. unreadable: não deu para ler (no WSL, o arquivo atrás do \\wsl.localhost).
export type StoredState = 'ok' | 'ended' | 'empty' | 'missing' | 'unreadable'

export function loginState(stored: Stored | null): StoredState {
  const oauth = stored?.claudeAiOauth
  if (!oauth) return 'empty'
  if (oauth.accessToken) return 'ok'
  return oauth.refreshToken === '' || oauth.loginEnded ? 'ended' : 'empty'
}

// O guardado e o estado dele. Nunca rejeita.
export async function readStoredState(account: string): Promise<{ stored: Stored | null; state: StoredState }> {
  let text: string
  try {
    if (!IS_MAC) text = await readFile(credentialsFile(account), 'utf8')
    else {
      const service = keychainService(accountDir(account))
      text = (await run('security', ['find-generic-password', '-a', keychainAccount(), '-s', service, '-w'])).stdout
    }
  } catch (err) {
    // Sem o arquivo; no Mac, o `security` sai com 44 quando o item não existe nas Chaves.
    const code = (err as { code?: unknown } | null)?.code
    return { stored: null, state: code === 'ENOENT' || code === 44 ? 'missing' : 'unreadable' }
  }
  try {
    const stored = JSON.parse(text.trim()) as Stored | null
    return { stored, state: loginState(stored) }
  } catch {
    return { stored: null, state: 'unreadable' }
  }
}

// null sem login guardado, ou se não deu para ler.
export async function readStored(account: string): Promise<Stored | null> {
  return (await readStoredState(account)).stored
}
