import { homedir } from 'node:os'
import { query, type Query } from '@anthropic-ai/claude-agent-sdk'
import type { McpAuthResult, McpStatus } from '../../shared/mcp'
import { claudeCodeOptions } from './env'
import { Inbox } from './inbox'
import { authenticateMcp, clearMcpAuth, mcpServersOf, removeMcp } from './mcpStatus'

// Sem chamada nesse tempo (aba fechada sem avisar), o `claude` da conta fecha sozinho. Enquanto a
// aba espera uma autorização, ela pergunta a cada segundo e o mantém aberto.
const IDLE_MS = 5 * 60_000

// Os que valem em qualquer pasta. Os de projeto (.mcp.json) e os locais ficam no /mcp da conversa.
const PER_FOLDER = new Set(['project', 'local'])

type Probe = { q: Query; inbox: Inbox; timer: ReturnType<typeof setTimeout> }

// MCPs de uma conta, para a aba MCP das configurações: um `claude` na pasta pessoal, aberto enquanto
// a aba está na tela. Precisa ficar aberto para receber a volta do navegador ao autorizar. O login
// fica na conta, então vale para todas as conversas dela.
export class AccountMcp {
  private probes = new Map<string, Probe>()

  private probe(account: string): Query {
    const current = this.probes.get(account)
    if (current) {
      clearTimeout(current.timer)
      current.timer = setTimeout(() => this.release(account), IDLE_MS)
      return current.q
    }
    const inbox = new Inbox()
    const q = query({ prompt: inbox, options: { ...claudeCodeOptions(homedir(), account || undefined), persistSession: false } })
    this.probes.set(account, { q, inbox, timer: setTimeout(() => this.release(account), IDLE_MS) })
    return q
  }

  // wait: a primeira consulta espera os servidores terminarem de conectar; as seguintes (a aba
  // acompanhando quem conecta) devolvem como está.
  async status(account: string, wait: boolean): Promise<McpStatus> {
    try {
      const servers = await mcpServersOf(this.probe(account), wait)
      return { ok: true, servers: servers.filter((s) => !PER_FOLDER.has(s.scope ?? '')), live: true }
    } catch (err) {
      this.release(account)
      return { ok: false, error: (err as Error).message }
    }
  }

  async reconnect(account: string, name: string): Promise<McpStatus> {
    try {
      await this.probe(account).reconnectMcpServer(name)
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
    return this.status(account, false)
  }

  authenticate(account: string, name: string): Promise<McpAuthResult> {
    return authenticateMcp(this.probe(account), name)
  }

  async clearAuth(account: string, name: string): Promise<McpStatus> {
    try {
      await clearMcpAuth(this.probe(account), name)
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
    return this.status(account, false)
  }

  // Remove da conta e reabre o `claude` dela, para a lista vir sem ele.
  async remove(account: string, name: string, scope: string): Promise<McpStatus> {
    try {
      await removeMcp(name, scope, account || undefined, homedir())
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
    this.release(account)
    return this.status(account, true)
  }

  release(account: string): void {
    const p = this.probes.get(account)
    if (!p) return
    this.probes.delete(account)
    clearTimeout(p.timer)
    p.inbox.close()
    p.q.close()
  }

  closeAll(): void {
    ;[...this.probes.keys()].forEach((a) => this.release(a))
  }
}
