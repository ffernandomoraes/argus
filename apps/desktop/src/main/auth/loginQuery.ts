import { homedir } from 'node:os'
import { query, type Query } from '@anthropic-ai/claude-agent-sdk'
import { claudeProcess, Inbox } from '../chats'

// O SDK tem os pedidos de login, mas não os publica nos tipos. Conferido na 0.3.289.
export type LoginQuery = Query & {
  claudeAuthenticate(loginWithClaudeAi: boolean): Promise<{ manualUrl: string; automaticUrl: string }>
  claudeOAuthCallback(authorizationCode: string, state: string): Promise<unknown>
  claudeOAuthWaitForCompletion(): Promise<unknown>
}

// Um `claude` aberto só para o login, na pasta da conta: sem configurações nem MCPs, e sem
// ferramenta liberada. place: uma pasta do WSL, para o login ser o da conta naquela distro (ver
// wslPlace.ts); sem ela, o `claude` do app.
export function openLoginQuery(accountId: string, place?: string): { q: LoginQuery; inbox: Inbox } {
  const inbox = new Inbox()
  const q = query({
    prompt: inbox,
    options: {
      cwd: homedir(),
      ...claudeProcess(accountId, place),
      settingSources: [],
      strictMcpConfig: true,
      persistSession: false,
      canUseTool: async () => ({ behavior: 'deny', message: 'Só login' })
    }
  }) as LoginQuery
  return { q, inbox }
}
