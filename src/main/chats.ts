import { dirname } from 'node:path'
import {
  query,
  type CanUseTool,
  type PermissionMode,
  type PermissionResult,
  type PermissionUpdate,
  type Query,
  type SDKUserMessage
} from '@anthropic-ai/claude-agent-sdk'
import type { ChatSendRequest, ChatSettings, ChatState, PermissionAnswer, Question } from '../shared/chat'
import { claudePath } from './claudePath'
import { learnContextWindow } from './contextWindows'
import { diffFromInput } from './diffs'
import { describeTool } from './toolLabels'
import { expandHome } from './paths'

// Fila que alimenta a sessão: cada envio do chat vira uma mensagem para o Claude.
class Inbox implements AsyncIterable<SDKUserMessage> {
  private items: SDKUserMessage[] = []
  private wake: (() => void) | null = null
  private closed = false

  push(item: SDKUserMessage): void {
    this.items.push(item)
    this.wake?.()
  }

  close(): void {
    this.closed = true
    this.wake?.()
  }

  async *[Symbol.asyncIterator](): AsyncIterator<SDKUserMessage> {
    while (true) {
      if (this.items.length) yield this.items.shift()!
      else if (this.closed) return
      else await new Promise<void>((r) => (this.wake = r))
    }
  }
}

// "manual" é o nome que o app mostra; para o Claude Code é "default".
function toPermissionMode(mode: string): PermissionMode | undefined {
  if (!mode) return undefined
  return (mode === 'manual' ? 'default' : mode) as PermissionMode
}

type Waiting = { resolve: (r: PermissionResult) => void; input: Record<string, unknown>; suggestions?: PermissionUpdate[] }

class ChatSession {
  readonly keys = new Set<string>()
  // Conversa já fechada na tela: encerrar assim que o Claude parar.
  closeWhenIdle = false
  state: ChatState = { status: 'idle', partial: '', permissions: [], revision: 0, turnTokens: 0 }
  private inbox = new Inbox()
  private q: Query
  private waiting = new Map<string, Waiting>()
  private flushTimer: NodeJS.Timeout | null = null
  // Tokens do pedido em andamento: respostas já fechadas + a que está sendo escrita.
  private closedTokens = 0
  private currentTokens = 0

  constructor(
    key: string,
    req: ChatSendRequest,
    private emit: (session: ChatSession) => void,
    private onEnd: (session: ChatSession) => void,
    private onSessionId: (session: ChatSession, id: string) => void
  ) {
    this.keys.add(key)
    const claude = claudePath()
    const env = { ...process.env } as Record<string, string>
    delete env.ELECTRON_RUN_AS_NODE
    delete env.ELECTRON_NO_ATTACH_CONSOLE
    env.PATH = [dirname(claude), '/opt/homebrew/bin', '/usr/local/bin', env.PATH].filter(Boolean).join(':')
    const s = req.settings
    const flags: Record<string, boolean> = {}
    if (!s.thinking) flags.alwaysThinkingEnabled = false
    if (s.ultracode) flags.ultracode = true

    this.q = query({
      prompt: this.inbox,
      options: {
        cwd: expandHome(req.cwd),
        pathToClaudeCodeExecutable: claude,
        env,
        // Mesmo comportamento do Claude Code no terminal: prompt, CLAUDE.md, configurações e MCPs.
        systemPrompt: { type: 'preset', preset: 'claude_code' },
        includePartialMessages: true,
        resume: req.sessionId,
        model: s.model || undefined,
        effort: (s.effort || undefined) as never,
        permissionMode: toPermissionMode(s.permissionMode),
        settings: Object.keys(flags).length ? (flags as never) : undefined,
        canUseTool: this.canUseTool
      }
    })
    void this.run()
  }

  private update(patch: Partial<ChatState>, now = true): void {
    this.state = { ...this.state, ...patch }
    if (now) {
      if (this.flushTimer) clearTimeout(this.flushTimer)
      this.flushTimer = null
      this.emit(this)
    } else if (!this.flushTimer) {
      // Texto chegando aos pedaços: junta para não redesenhar a cada letra.
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null
        this.emit(this)
      }, 50)
    }
  }

  private canUseTool: CanUseTool = (toolName, input, options) =>
    new Promise<PermissionResult>((resolve) => {
      const id = options.toolUseID
      this.waiting.set(id, { resolve, input, suggestions: options.suggestions })
      const title = (options as { title?: string }).title
      const d = describeTool(toolName, input)
      this.update({
        status: 'needs-you',
        permissions: [
          ...this.state.permissions,
          {
            id,
            toolName,
            title,
            label: d.label,
            summary: d.summary,
            detail: d.detail,
            canAlwaysAllow: !!options.suggestions?.length,
            diff: diffFromInput(toolName, input),
            questions: toolName === 'AskUserQuestion' ? (input.questions as Question[]) : undefined
          }
        ]
      })
      // Interrompido antes da resposta: o pedido some.
      options.signal.addEventListener('abort', () => this.dropPermission(id))
    })

  private dropPermission(id: string): void {
    this.waiting.delete(id)
    const permissions = this.state.permissions.filter((p) => p.id !== id)
    this.update({ permissions, status: permissions.length ? 'needs-you' : this.state.status === 'idle' ? 'idle' : 'running' })
  }

  answer(id: string, answer: PermissionAnswer): void {
    const w = this.waiting.get(id)
    if (!w) return
    w.resolve(
      typeof answer === 'object'
        ? // Perguntas: as respostas vão junto da entrada da ferramenta, como faz o Claude Code.
          { behavior: 'allow', updatedInput: { ...w.input, answers: answer.answers } }
        : answer === 'deny'
          ? { behavior: 'deny', message: 'A pessoa negou esta ação.' }
          : { behavior: 'allow', updatedInput: w.input, ...(answer === 'always' && { updatedPermissions: w.suggestions }) }
    )
    this.dropPermission(id)
  }

  send(req: ChatSendRequest): void {
    const content = [
      ...req.images.map((img) => ({
        type: 'image' as const,
        source: { type: 'base64' as const, media_type: img.mediaType as 'image/png', data: img.data }
      })),
      ...(req.text ? [{ type: 'text' as const, text: req.text }] : [])
    ]
    this.inbox.push({ type: 'user', message: { role: 'user', content }, parent_tool_use_id: null })
    // Mensagem nova com o Claude parado começa a contagem de tempo e tokens.
    const fresh = this.state.status === 'idle' || !this.state.turnStartedAt
    if (fresh) {
      this.closedTokens = 0
      this.currentTokens = 0
    }
    this.update({ status: 'running', error: undefined, ...(fresh && { turnStartedAt: Date.now(), turnTokens: 0 }) })
  }

  async interrupt(): Promise<void> {
    try {
      await this.q.interrupt()
    } catch {
      // já parado
    }
  }

  // Mudanças feitas nos seletores com a conversa aberta.
  async configure(patch: Partial<ChatSettings>): Promise<void> {
    try {
      if (patch.model !== undefined) await this.q.setModel(patch.model || undefined)
      if (patch.permissionMode !== undefined) {
        await this.q.setPermissionMode(toPermissionMode(patch.permissionMode) ?? 'default')
      }
      const flags: Record<string, unknown> = {}
      if (patch.effort !== undefined) flags.effortLevel = patch.effort || null
      if (patch.thinking !== undefined) flags.alwaysThinkingEnabled = patch.thinking
      if (patch.ultracode !== undefined) flags.ultracode = patch.ultracode
      if (Object.keys(flags).length) await this.q.applyFlagSettings(flags as never)
    } catch (err) {
      this.update({ error: `Não consegui aplicar a mudança: ${(err as Error).message}` })
    }
  }

  close(): void {
    for (const w of this.waiting.values()) w.resolve({ behavior: 'deny', message: 'Conversa fechada.' })
    this.waiting.clear()
    this.inbox.close()
    this.q.close()
  }

  private async run(): Promise<void> {
    try {
      for await (const m of this.q) {
        if (m.type === 'system' && m.subtype === 'init') {
          this.onSessionId(this, m.session_id)
          this.update({ sessionId: m.session_id })
        } else if (m.type === 'stream_event') {
          const e = m.event
          if (m.parent_tool_use_id) continue
          // A prévia só é trocada quando começa outra resposta: até lá o chat já releu o histórico.
          if (e.type === 'message_start') {
            this.closedTokens += this.currentTokens
            this.currentTokens = 0
            this.update({ partial: '' }, false)
          } else if (e.type === 'content_block_delta' && e.delta.type === 'text_delta') {
            this.update({ partial: this.state.partial + e.delta.text }, false)
          } else if (e.type === 'message_delta' && typeof e.usage?.output_tokens === 'number') {
            this.currentTokens = e.usage.output_tokens
            this.update({ turnTokens: this.closedTokens + this.currentTokens }, false)
          }
        } else if (m.type === 'assistant' || m.type === 'user') {
          // Já gravado no arquivo: o chat relê o histórico.
          this.update({ revision: this.state.revision + 1 })
        } else if (m.type === 'result') {
          for (const [model, u] of Object.entries(m.modelUsage ?? {})) learnContextWindow(model, u.contextWindow)
          const failed = m.subtype !== 'success' || m.is_error
          this.update({
            status: this.waiting.size ? 'needs-you' : 'idle',
            turnStartedAt: undefined,
            partial: '',
            revision: this.state.revision + 1,
            error: failed ? ('result' in m && m.result ? m.result : 'O Claude parou com erro.') : undefined
          })
        }
      }
    } catch (err) {
      this.update({ error: (err as Error).message })
    } finally {
      this.update({ status: 'idle', partial: '', permissions: [], revision: this.state.revision + 1 })
      this.onEnd(this)
    }
  }
}

// Conversa fechada espera um pouco antes de encerrar: trocar de conversa ou a tela
// se redesenhar não pode derrubar uma sessão que volta em seguida.
const RELEASE_DELAY_MS = 5_000

// Uma sessão do Claude por conversa aberta no chat. A chave é o id da conversa no app;
// conversa nova ganha também o id da sessão como chave, assim que o Claude informa.
export class Chats {
  private sessions = new Map<string, ChatSession>()
  // Conversas fechadas esperando encerrar.
  private releasing = new Map<ChatSession, NodeJS.Timeout>()

  constructor(private onState: (key: string, state: ChatState) => void) {}

  // Conversa aberta de novo: cancela o encerramento que estava agendado.
  retain(key: string): void {
    const session = this.sessions.get(key)
    if (!session) return
    clearTimeout(this.releasing.get(session))
    this.releasing.delete(session)
    session.closeWhenIdle = false
  }

  // Conversa fechada: encerra a sessão. Se o Claude ainda está trabalhando, espera ele
  // terminar em vez de derrubar no meio.
  release(key: string): void {
    const session = this.sessions.get(key)
    if (!session || this.releasing.has(session)) return
    this.releasing.set(
      session,
      setTimeout(() => {
        this.releasing.delete(session)
        if (session.state.status === 'idle') this.closeSession(session)
        else session.closeWhenIdle = true
      }, RELEASE_DELAY_MS)
    )
  }

  // Nenhuma janela aberta: nada precisa das sessões de chat.
  releaseAll(): void {
    new Set(this.sessions.values()).forEach((s) => {
      if (s.state.status === 'idle') this.closeSession(s)
      else s.closeWhenIdle = true
    })
  }

  private closeSession(session: ChatSession): void {
    clearTimeout(this.releasing.get(session))
    this.releasing.delete(session)
    session.keys.forEach((k) => this.sessions.get(k) === session && this.sessions.delete(k))
    session.close()
  }

  state(key: string): ChatState | null {
    return this.sessions.get(key)?.state ?? null
  }

  has(key: string): boolean {
    return this.sessions.has(key)
  }

  send(req: ChatSendRequest): void {
    let session = this.sessions.get(req.key) ?? (req.sessionId ? this.sessions.get(req.sessionId) : undefined)
    if (!session) {
      session = new ChatSession(
        req.key,
        req,
        (s) => {
          s.keys.forEach((k) => this.onState(k, s.state))
          // Fechada na tela e o Claude parou: encerra agora, sem deixar processo aberto.
          if (s.closeWhenIdle && s.state.status === 'idle') this.closeSession(s)
        },
        (s) => s.keys.forEach((k) => this.sessions.get(k) === s && this.sessions.delete(k)),
        (s, id) => {
          s.keys.add(id)
          this.sessions.set(id, s)
        }
      )
      this.sessions.set(req.key, session)
    }
    session.send(req)
  }

  answer(key: string, id: string, answer: PermissionAnswer): void {
    this.sessions.get(key)?.answer(id, answer)
  }

  interrupt(key: string): void {
    void this.sessions.get(key)?.interrupt()
  }

  configure(key: string, patch: Partial<ChatSettings>): void {
    void this.sessions.get(key)?.configure(patch)
  }

  close(key: string): void {
    const s = this.sessions.get(key)
    if (s) this.closeSession(s)
  }

  closeAll(): void {
    this.releasing.forEach((timer) => clearTimeout(timer))
    this.releasing.clear()
    new Set(this.sessions.values()).forEach((s) => s.close())
    this.sessions.clear()
  }
}
