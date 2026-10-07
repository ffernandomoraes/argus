import { execFile } from 'node:child_process'
import { homedir } from 'node:os'
import { promisify } from 'node:util'
import { shell } from 'electron'
import { query, type Query } from '@anthropic-ai/claude-agent-sdk'
import type { Account, AuthState, LoginMethod } from '../shared/auth'
import { claudeEnv, Inbox } from './chats'
import { claudePath } from './claudePath'

// Mesmo caminho da extensão do VS Code: um `claude` aberto só para o login gera o link,
// recebe o retorno do navegador e grava o login nas Chaves do macOS, onde o Claude Code
// inteiro (terminal, VS Code, este app) passa a usar.

const run = promisify(execFile)

// O SDK tem os pedidos de login, mas não os publica nos tipos. Conferido na 0.3.289.
type LoginQuery = Query & {
  claudeAuthenticate(loginWithClaudeAi: boolean): Promise<{ manualUrl: string; automaticUrl: string }>
  claudeOAuthCallback(authorizationCode: string, state: string): Promise<unknown>
  claudeOAuthWaitForCompletion(): Promise<unknown>
}

async function readAccount(): Promise<Account | null> {
  const claude = claudePath()
  try {
    const { stdout } = await run(claude, ['auth', 'status', '--json'], { env: claudeEnv(claude), timeout: 15_000 })
    const s = JSON.parse(stdout) as Record<string, unknown>
    const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined)
    return {
      loggedIn: s.loggedIn === true,
      method: str(s.authMethod),
      provider: str(s.apiProvider),
      email: str(s.email),
      organization: str(s.orgName),
      subscriptionType: str(s.subscriptionType)
    }
  } catch (err) {
    // Sem login o comando sai com erro, mas ainda responde o JSON.
    const stdout = (err as { stdout?: string }).stdout
    if (stdout?.includes('"loggedIn"')) {
      try {
        return { loggedIn: (JSON.parse(stdout) as { loggedIn?: boolean }).loggedIn === true }
      } catch {
        // cai no aviso abaixo
      }
    }
    console.warn('[auth] claude auth status falhou:', (err as Error).message)
    return null
  }
}

export class Auth {
  state: AuthState = { account: null, login: { status: 'idle' } }
  private session: { q: LoginQuery; inbox: Inbox } | null = null

  constructor(
    private onState: (state: AuthState) => void,
    // Entrou ou saiu: o que roda com o login antigo precisa recomeçar.
    private onAccountChanged: () => void
  ) {}

  private set(patch: Partial<AuthState>): void {
    this.state = { ...this.state, ...patch }
    this.onState(this.state)
  }

  async refresh(): Promise<void> {
    this.set({ account: await readAccount() })
  }

  async login(method: LoginMethod): Promise<void> {
    this.stop()
    const claude = claudePath()
    const inbox = new Inbox()
    const q = query({
      prompt: inbox,
      options: {
        cwd: homedir(),
        pathToClaudeCodeExecutable: claude,
        env: claudeEnv(claude),
        settingSources: [],
        strictMcpConfig: true,
        persistSession: false,
        canUseTool: async () => ({ behavior: 'deny', message: 'Só login' })
      }
    }) as LoginQuery
    const session = { q, inbox }
    this.session = session
    const current = () => this.session === session
    this.set({ login: { status: 'starting', method } })

    try {
      const { manualUrl, automaticUrl } = await q.claudeAuthenticate(method === 'claudeai')
      if (!current()) return
      // Pede antes de abrir o navegador, para não perder um retorno rápido.
      const done = q.claudeOAuthWaitForCompletion()
      this.set({ login: { status: 'waiting', method, automaticUrl, manualUrl } })
      void shell.openExternal(automaticUrl)
      await done
      if (!current()) return
      // Confere a conta antes de sair da espera, para a tela não voltar às opções por um instante.
      await this.refresh()
      if (!current()) return
      this.stop()
      this.onAccountChanged()
    } catch (err) {
      if (!current()) return
      this.stop()
      this.set({ login: { status: 'error', message: (err as Error).message || 'Não deu para entrar.' } })
    }
  }

  // Código copiado da página do navegador, no formato "código#estado".
  submitCode(code: string): void {
    const s = this.session
    if (!s) return
    const [authorizationCode, state = ''] = code.trim().split('#')
    s.q.claudeOAuthCallback(authorizationCode, state).catch((err: Error) => {
      if (this.session === s) this.set({ login: { status: 'error', message: err.message || 'Código recusado.' } })
    })
  }

  cancel(): void {
    this.stop()
  }

  // Sai do Claude Code neste Mac, como o "Sign out" da extensão do VS Code.
  async logout(): Promise<boolean> {
    this.stop()
    const claude = claudePath()
    let ok = true
    try {
      await run(claude, ['auth', 'logout'], { env: claudeEnv(claude), timeout: 15_000 })
    } catch (err) {
      console.warn('[auth] claude auth logout falhou:', (err as Error).message)
      ok = false
    }
    await this.refresh()
    this.onAccountChanged()
    return ok
  }

  private stop(): void {
    const s = this.session
    this.session = null
    if (s) {
      s.inbox.close()
      s.q.close()
    }
    if (this.state.login.status !== 'idle') this.set({ login: { status: 'idle' } })
  }
}
