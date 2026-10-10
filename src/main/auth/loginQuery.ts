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
// ferramenta liberada.
export function openLoginQuery(accountId: string): { q: LoginQuery; inbox: Inbox } {
  const inbox = new Inbox()
  const q = query({
    prompt: inbox,
    options: {
      cwd: homedir(),
      ...claudeProcess(accountId),
      settingSources: [],
      strictMcpConfig: true,
      persistSession: false,
      canUseTool: async () => ({ behavior: 'deny', message: 'Só login' })
    }
  }) as LoginQuery
  return { q, inbox }
}
