import { homedir } from 'node:os'
import { createSdkMcpServer, query, type Query } from '@anthropic-ai/claude-agent-sdk'
import type { WebContents } from 'electron'
import type { CanvasAgentState, CanvasToolResult } from '../../shared/canvasAgent'
import { claudeProcess, Inbox } from '../chats'
import { PendingCalls } from './pendingCalls'
import { MODEL, SYSTEM_PROMPT } from './prompt'
import { canvasTools, fail, ok } from './tools'

// Sem pedido por um tempo, a sessão fecha: o próximo comando começa sem a conversa antiga.
const IDLE_CLOSE_MS = 15 * 60_000

type Session = { q: Query; inbox: Inbox }

// Uma sessão do Claude só com ferramentas do canvas. A janela do canvas executa as ações,
// porque é ela que tem o estado dos blocos (e o desfazer).
export class CanvasAgent {
  state: CanvasAgentState = { status: 'idle', reply: '' }
  private session: Session | null = null
  private calls: PendingCalls
  private idleTimer: NodeJS.Timeout | null = null

  constructor(
    target: () => WebContents | null,
    private onState: (state: CanvasAgentState) => void
  ) {
    this.calls = new PendingCalls(target)
  }

  private update(patch: Partial<CanvasAgentState>): void {
    this.state = { ...this.state, ...patch }
    this.onState(this.state)
  }

  result(r: CanvasToolResult): void {
    this.calls.settle(r)
  }

  // Ferramenta executada pela janela do canvas; o rótulo aparece na barra enquanto roda.
  private forward = (name: string, label: string) => async (args: Record<string, unknown>) => {
    this.update({ activity: label })
    const r = await this.calls.call(name, args)
    return r.error ? fail(r.text) : ok(r.text)
  }

  private open(): Session {
    if (this.session) return this.session
    const inbox = new Inbox()
    const tools = canvasTools({ forward: this.forward, activity: (label) => this.update({ activity: label }) })
    const server = createSdkMcpServer({ name: 'canvas', tools, alwaysLoad: true })
    const q = query({
      prompt: inbox,
      options: {
        cwd: homedir(),
        ...claudeProcess(),
        model: MODEL,
        systemPrompt: SYSTEM_PROMPT,
        // Só as ferramentas do canvas: nada de arquivos, terminal, CLAUDE.md ou MCPs da pessoa.
        tools: [],
        settingSources: [],
        strictMcpConfig: true,
        mcpServers: { canvas: server },
        canUseTool: async (_name, input) => ({ behavior: 'allow', updatedInput: input }),
        persistSession: false
      }
    })
    const session = { q, inbox }
    this.session = session
    void this.run(session)
    return session
  }

  private async run(session: Session): Promise<void> {
    try {
      for await (const m of session.q) {
        if (m.type === 'result') {
          const failed = m.subtype !== 'success' || m.is_error
          const text = 'result' in m ? m.result : ''
          this.update({
            status: 'idle',
            activity: undefined,
            reply: failed ? '' : text,
            error: failed ? text || 'O Claude parou com erro.' : undefined
          })
        }
      }
    } catch (err) {
      this.update({ status: 'idle', activity: undefined, error: (err as Error).message })
    } finally {
      if (this.session === session) {
        this.session = null
        // A sessão caiu sozinha: as ações que esperavam a janela não têm mais quem as receba.
        this.calls.cancelAll('Cancelado.')
      }
      if (this.state.status === 'running') this.update({ status: 'idle', activity: undefined })
    }
  }

  send(text: string): void {
    if (this.idleTimer) clearTimeout(this.idleTimer)
    this.idleTimer = setTimeout(() => this.close(), IDLE_CLOSE_MS)
    this.update({ status: 'running', reply: '', activity: undefined, error: undefined })
    this.open().inbox.push({ type: 'user', message: { role: 'user', content: text }, parent_tool_use_id: null })
  }

  // Parar: as ações que esperavam a janela (inclusive o seletor de pasta aberto) são canceladas
  // primeiro, para nada acontecer depois do "parar".
  async interrupt(): Promise<void> {
    this.calls.cancelAll('Cancelado.')
    try {
      await this.session?.q.interrupt()
    } catch {
      // já parado
    }
    this.update({ status: 'idle', activity: undefined })
  }

  close(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer)
    this.idleTimer = null
    this.calls.cancelAll('Cancelado.')
    const s = this.session
    this.session = null
    if (!s) return
    s.inbox.close()
    s.q.close()
  }
}
