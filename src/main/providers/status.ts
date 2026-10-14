import { execFile } from 'node:child_process'
import { homedir } from 'node:os'
import { app } from 'electron'
import type { ProviderAccountStatus, ProviderId } from '../../shared/providers'
import { tr } from '../i18n'
import { providerLaunch, type Launch } from './env'
import { keyHint, readKey } from './keys'
import { JsonRpcProcess } from './rpc'

// Conferência do login de cada conta, sem abrir conversa. Falha passageira (o CLI não respondeu)
// devolve null: quem chama mantém o que sabia.

// Codex: o app-server, como a extensão do VS Code. Abre, se apresenta e devolve o processo pronto.
export async function openCodex(launch: Launch, cwd?: string): Promise<JsonRpcProcess> {
  const rpc = new JsonRpcProcess(launch, cwd)
  try {
    await rpc.request('initialize', {
      clientInfo: { name: 'argus', title: 'Argus', version: app.getVersion() },
      capabilities: { experimentalApi: true }
    })
  } catch (err) {
    // Quem chama não recebe o processo: sem fechar aqui, um app-server que não respondeu ficaria aberto.
    rpc.close()
    throw err
  }
  rpc.notify('initialized')
  return rpc
}

type CodexAccount = { account: { type: string; email?: string; planType?: string } | null }

export function codexStatus(read: CodexAccount): ProviderAccountStatus {
  const a = read.account
  if (!a) return { signedIn: false }
  return a.type === 'apiKey' ? { signedIn: true, plan: tr('Chave de API', 'API key') } : { signedIn: true, email: a.email, plan: planName(a.planType) }
}

const PLANS: Record<string, string> = { free: 'Free', go: 'Go', plus: 'Plus', pro: 'Pro', team: 'Team', business: 'Business', enterprise: 'Enterprise', edu: 'Edu' }
const planName = (plan?: string) => (plan ? (PLANS[plan] ?? plan) : undefined)

export function runCli(launch: Launch, timeoutMs = 30_000): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) =>
    execFile(launch.file, launch.args, { env: launch.env, cwd: homedir(), timeout: timeoutMs, windowsHide: true, encoding: 'utf8' }, (err, stdout, stderr) =>
      resolve({ code: err ? (typeof err.code === 'number' ? err.code : 1) : 0, stdout, stderr })
    )
  )
}

type CursorStatus = { isAuthenticated?: boolean; userInfo?: { email?: string; teamName?: string } }

export async function cursorStatus(accountId: string): Promise<ProviderAccountStatus | null> {
  const launch = providerLaunch('cursor', ['status', '--format', 'json'], accountId)
  if (!launch) return null
  const out = await runCli(launch)
  try {
    const s = JSON.parse(out.stdout) as CursorStatus
    return { signedIn: !!s.isAuthenticated, email: s.userInfo?.email, plan: s.userInfo?.teamName }
  } catch {
    return null
  }
}

export async function readStatus(provider: ProviderId, accountId: string, kind: 'login' | 'key'): Promise<ProviderAccountStatus | null> {
  if (kind === 'key') {
    // Conta por chave: vale enquanto a chave existir; ela é testada ao entrar (ver checkKey).
    const key = readKey(provider, accountId)
    if (!key) return { signedIn: false }
    if (provider === 'cursor') {
      const s = await cursorStatus(accountId)
      if (s?.signedIn) return { ...s, keyHint: keyHint(key) }
    }
    return { signedIn: true, keyHint: keyHint(key) }
  }
  if (provider === 'cursor') return cursorStatus(accountId)
  if (provider === 'codex') {
    const launch = providerLaunch('codex', ['app-server'], accountId)
    if (!launch) return null
    let rpc: JsonRpcProcess | null = null
    try {
      rpc = await openCodex(launch)
      return codexStatus(await rpc.request<CodexAccount>('account/read', { refreshToken: false }, 20_000))
    } catch (err) {
      console.warn('[providers] codex account/read falhou:', (err as Error).message)
      return null
    } finally {
      rpc?.close()
    }
  }
  return null
}

// Testa uma chave antes de guardar. Devolve nulo se ela funciona; senão, o motivo em português.
export async function checkKey(provider: ProviderId, key: string, accountId: string): Promise<string | null> {
  if (provider === 'gemini') {
    // A própria API do Gemini lista os modelos que a chave pode usar: é a conferência mais barata.
    try {
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', {
        headers: { 'x-goog-api-key': key },
        signal: AbortSignal.timeout(20_000)
      })
      if (res.ok) return null
      if (res.status === 400 || res.status === 401 || res.status === 403)
        return tr('O Google recusou essa chave. Confira se copiou a chave inteira.', 'Google rejected this key. Check that you copied the whole key.')
      return tr(`O Google respondeu com erro (HTTP ${res.status}). Tente de novo.`, `Google answered with an error (HTTP ${res.status}). Try again.`)
    } catch {
      return tr('Não deu para falar com o Google. Confira a internet e tente de novo.', 'Couldn’t reach Google. Check your connection and try again.')
    }
  }
  if (provider === 'cursor') {
    const launch = providerLaunch('cursor', ['models'], accountId)
    if (!launch) return tr('O Cursor CLI não está instalado.', 'Cursor CLI is not installed.')
    launch.env.CURSOR_API_KEY = key
    const out = await runCli(launch, 45_000)
    if (out.code === 0) return null
    if (/invalid/i.test(out.stdout + out.stderr))
      return tr('O Cursor recusou essa chave. Confira se copiou a chave inteira.', 'Cursor rejected this key. Check that you copied the whole key.')
    return tr('O Cursor não confirmou a chave. Tente de novo.', 'Cursor didn’t confirm the key. Try again.')
  }
  return tr('Esse agente não usa chave.', 'This agent doesn’t use a key.')
}
