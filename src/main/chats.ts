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
import type { RunningAgent } from '../shared/agents'
import type {
  ChatRemoteRequest,
  ChatSendRequest,
  ChatSettings,
  ChatState,
  PermissionAnswer,
  Question,
  RemoteControl
} from '../shared/chat'
import type { McpServer, McpStatus } from '../shared/mcp'
import { claudePath } from './claudePath'
import { learnContextWindow } from './contextWindows'
import { diffFromInput } from './diffs'
import { describeTool } from './toolLabels'
import { expandHome } from './paths'

// Fila que alimenta a sessão: cada envio do chat vira uma mensagem para o Claude.
export class Inbox implements AsyncIterable<SDKUserMessage> {
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

// O SDK tem o pedido de remote control (o mesmo que a extensão do VS Code usa), mas não o
// publica nos tipos. Resposta conferida na 0.3.289: { session_url, bridge_session_id, ... }.
type RemoteControlQuery = Query & {
  enableRemoteControl(enabled: boolean, name?: string): Promise<{ session_url?: string } | undefined>
}

// Últimas ferramentas de cada subagente guardadas para mostrar no chat.
const AGENT_STEPS_MAX = 40

type Line = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

type Waiting = { resolve: (r: PermissionResult) => void; input: Record<string, unknown>; suggestions?: PermissionUpdate[] }

// O app aberto pelo Finder não herda o PATH do terminal, e as variáveis do Electron
// fariam o `claude` subir como Node puro.
export function claudeEnv(claude: string): Record<string, string> {
  const env = { ...process.env } as Record<string, string>
  delete env.ELECTRON_RUN_AS_NODE
  delete env.ELECTRON_NO_ATTACH_CONSOLE
  env.PATH = [dirname(claude), '/opt/homebrew/bin', '/usr/local/bin', env.PATH].filter(Boolean).join(':')
  return env
}

class ChatSession {
  readonly keys = new Set<string>()
  readonly cwd: string
  // Conversa já fechada na tela: encerrar assim que o Claude parar.
  closeWhenIdle = false
  // Parada pedida por você: o fim do pedido não é erro.
  private interrupted = false
  state: ChatState = { status: 'idle', partial: '', permissions: [], revision: 0, turnTokens: 0, agents: [] }
  private inbox = new Inbox()
  private q: Query
  private waiting = new Map<string, Waiting>()
  private flushTimer: NodeJS.Timeout | null = null
  // Tokens do pedido em andamento: respostas já fechadas + a que está sendo escrita.
  private closedTokens = 0
  private currentTokens = 0

  constructor(
    key: string,
    req: Omit<ChatSendRequest, 'text' | 'images'>,
    private emit: (session: ChatSession) => void,
    private onEnd: (session: ChatSession) => void,
    private onSessionId: (session: ChatSession, id: string) => void
  ) {
    this.keys.add(key)
    this.cwd = req.cwd
    const claude = claudePath()
    const env = claudeEnv(claude)
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
        // Sem isso o SDK recusa o "Ignorar permissões", na abertura e na troca com a conversa aberta.
        allowDangerouslySkipPermissions: true,
        settings: Object.keys(flags).length ? (flags as never) : undefined,
        // Cada subagente manda uma frase do que está fazendo agora; aparece no ramo dele no canvas.
        agentProgressSummaries: true,
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
      ...(req.text ? [{ type: 'text' as const, text: req.text }] : []),
      // Depois do texto: o título da conversa continua sendo o que você escreveu.
      ...(req.hint ? [{ type: 'text' as const, text: req.hint }] : [])
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

  // Liga ou desliga o remote control. Ligado, a sessão continua de pé com a conversa fechada
  // na tela (ver Chats.release), para seguir respondendo pelo celular.
  async remoteControl(enabled: boolean): Promise<void> {
    if (enabled) this.update({ remote: { status: 'connecting' } })
    try {
      const r = await (this.q as RemoteControlQuery).enableRemoteControl(enabled)
      if (!enabled) return this.update({ remote: undefined })
      this.update({ remote: { status: 'connecting', ...this.state.remote, url: r?.session_url } })
    } catch (err) {
      this.update({ remote: enabled ? { status: 'failed', detail: (err as Error).message } : this.state.remote })
    }
  }

  // Trabalhando: respondendo ou com subagente em segundo plano ainda rodando.
  get busy(): boolean {
    return this.state.status !== 'idle' || this.state.agents.length > 0
  }

  get remoteOn(): boolean {
    return !!this.state.remote && this.state.remote.status !== 'failed'
  }

  mcpServers(): Promise<McpServer[]> {
    return settled(() => this.q.mcpServerStatus().then(toMcpServers))
  }

  async interrupt(): Promise<void> {
    // A tela reage na hora, sem esperar o Claude confirmar.
    this.interrupted = true
    this.update({ status: 'idle', partial: '', error: undefined, turnStartedAt: undefined })
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

  private patchAgent(match: (a: RunningAgent) => boolean, patch: (a: RunningAgent) => Partial<RunningAgent>): void {
    if (!this.state.agents.some(match)) return
    this.update({ agents: this.state.agents.map((a) => (match(a) ? { ...a, ...patch(a) } : a)) }, false)
  }

  private dropAgents(match: (a: RunningAgent) => boolean): void {
    if (!this.state.agents.some(match)) return
    this.update({ agents: this.state.agents.filter((a) => !match(a)) })
  }

  // Avisos de tarefa do Claude Code: subagente começou, avançou, terminou.
  private onTask(m: Line): void {
    if (m.ambient || m.skip_transcript) return
    if (m.subtype === 'task_started') {
      if (m.task_type !== 'local_agent' && !m.subagent_type) return
      if (this.state.agents.some((a) => a.id === m.task_id)) return
      const agent: RunningAgent = {
        id: m.task_id,
        toolUseId: m.tool_use_id,
        agent: m.subagent_type || 'general-purpose',
        description: m.description ?? '',
        startedAt: Date.now(),
        toolUses: 0,
        steps: [],
        background: !!m.is_backgrounded
      }
      this.update({ agents: [...this.state.agents, agent] })
    } else if (m.subtype === 'task_progress') {
      this.patchAgent(
        (a) => a.id === m.task_id,
        (a) => ({ toolUses: m.usage?.tool_uses ?? a.toolUses, summary: m.summary || a.summary })
      )
    } else if (m.subtype === 'task_updated') {
      const status = m.patch?.status
      if (status && status !== 'running' && status !== 'pending' && status !== 'paused') {
        this.dropAgents((a) => a.id === m.task_id)
      } else if (m.patch?.is_backgrounded !== undefined) {
        this.patchAgent((a) => a.id === m.task_id, () => ({ background: !!m.patch.is_backgrounded }))
      }
    } else if (m.subtype === 'task_notification') {
      this.dropAgents((a) => a.id === m.task_id)
    }
  }

  // Ferramenta usada por dentro de um subagente: entra na lista dele.
  private onSubagentMessage(parent: string, content: unknown): void {
    if (!Array.isArray(content)) return
    const uses = content.filter((c: Line) => c?.type === 'tool_use').map((c: Line) => describeTool(c.name, c.input))
    if (!uses.length) return
    this.patchAgent(
      (a) => a.toolUseId === parent,
      (a) => ({ steps: [...a.steps, ...uses.map((d) => ({ label: d.label, summary: d.summary }))].slice(-AGENT_STEPS_MAX) })
    )
  }

  private async run(): Promise<void> {
    try {
      for await (const m of this.q) {
        if (m.type === 'system' && m.subtype === 'init') {
          this.onSessionId(this, m.session_id)
          this.update({ sessionId: m.session_id })
        } else if (m.type === 'system' && (m.subtype as string) === 'bridge_state') {
          // Estado da conexão do remote control (ready, connected, failed...). Também fica fora
          // dos tipos do SDK, como o pedido.
          const b = m as unknown as { state: string; detail?: string }
          if (!this.state.remote) continue
          const status: RemoteControl['status'] =
            b.state === 'connected' ? 'connected' : b.state === 'failed' ? 'failed' : 'connecting'
          this.update({ remote: { ...this.state.remote, status, detail: b.detail } })
        } else if (m.type === 'system' && (m.subtype as string).startsWith('task_')) {
          this.onTask(m as Line)
        } else if (m.type === 'stream_event') {
          const e = m.event
          if (m.parent_tool_use_id) continue
          // A prévia só é trocada quando começa outra resposta: até lá o chat já releu o histórico.
          if (e.type === 'message_start') {
            // Pedido que chegou pelo remote control: o app não viu o envio, então marca aqui.
            if (this.state.status === 'idle') {
              this.closedTokens = 0
              this.currentTokens = 0
              this.update({ status: 'running', turnStartedAt: Date.now(), turnTokens: 0 }, false)
            }
            this.closedTokens += this.currentTokens
            this.currentTokens = 0
            this.update({ partial: '' }, false)
          } else if (e.type === 'content_block_delta' && e.delta.type === 'text_delta') {
            this.update({ partial: this.state.partial + e.delta.text }, false)
          } else if (e.type === 'message_delta' && typeof e.usage?.output_tokens === 'number') {
            this.currentTokens = e.usage.output_tokens
            this.update({ turnTokens: this.closedTokens + this.currentTokens }, false)
          }
        } else if ((m.type === 'assistant' || m.type === 'user') && m.parent_tool_use_id) {
          // Por dentro de um subagente: não mexe no histórico da conversa.
          if (m.type === 'assistant') this.onSubagentMessage(m.parent_tool_use_id, m.message.content)
        } else if (m.type === 'assistant' || m.type === 'user') {
          // Resultado da chamada que lançou o subagente: em primeiro plano, ele terminou.
          if (m.type === 'user' && Array.isArray(m.message.content)) {
            const done = new Set(
              (m.message.content as Line[]).filter((c) => c?.type === 'tool_result').map((c) => c.tool_use_id as string)
            )
            this.dropAgents((a) => !a.background && !!a.toolUseId && done.has(a.toolUseId))
          }
          // Já gravado no arquivo: o chat relê o histórico.
          this.update({ revision: this.state.revision + 1 })
        } else if (m.type === 'system' && m.subtype === 'compact_boundary') {
          // A compactação é gravada no arquivo da sessão: o chat relê e mostra o divisor.
          this.update({ revision: this.state.revision + 1 })
        } else if (m.type === 'result') {
          for (const [model, u] of Object.entries(m.modelUsage ?? {})) learnContextWindow(model, u.contextWindow)
          // Parada a seu pedido não vira mensagem de erro.
          const failed = (m.subtype !== 'success' || m.is_error) && !this.interrupted
          this.interrupted = false
          this.update({
            // Pedido encerrado: só os de segundo plano continuam.
            agents: this.state.agents.filter((a) => a.background),
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
      this.update({ status: 'idle', partial: '', permissions: [], agents: [], revision: this.state.revision + 1 })
      this.onEnd(this)
    }
  }
}

function toMcpServers(raw: Awaited<ReturnType<Query['mcpServerStatus']>>): McpServer[] {
  return raw
    .map((m) => ({
      name: m.name,
      status: m.status,
      tools: m.tools?.length ?? 0,
      error: m.error,
      scope: m.scope,
      version: m.serverInfo?.version
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

// Logo depois de abrir, vários servidores ainda estão conectando. Pergunta de novo até
// ninguém ficar em "conectando", ou até cansar de esperar.
const MCP_SETTLE_MS = 10_000
const MCP_RETRY_MS = 400

async function settled(ask: () => Promise<McpServer[]>): Promise<McpServer[]> {
  const deadline = Date.now() + MCP_SETTLE_MS
  let last = await ask()
  while (last.some((m) => m.status === 'pending') && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, MCP_RETRY_MS))
    last = await ask()
  }
  return last
}

// Status dos MCPs sem conversa aberta: sobe um `claude` só para perguntar e o encerra.
// Os servidores dependem da pasta, por isso não dá para usar um processo genérico.
async function mcpStatusFor(cwd: string): Promise<McpServer[]> {
  const claude = claudePath()
  const inbox = new Inbox()
  const q = query({
    prompt: inbox,
    options: {
      cwd: expandHome(cwd),
      pathToClaudeCodeExecutable: claude,
      env: claudeEnv(claude),
      systemPrompt: { type: 'preset', preset: 'claude_code' },
      persistSession: false
    }
  })
  try {
    return await settled(() => q.mcpServerStatus().then(toMcpServers))
  } finally {
    inbox.close()
    q.close()
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
        // Remote control ligado: a conversa segue pelo celular mesmo fechada aqui.
        if (session.remoteOn) return
        if (!session.busy) this.closeSession(session)
        else session.closeWhenIdle = true
      }, RELEASE_DELAY_MS)
    )
  }

  // Nenhuma janela aberta: nada precisa das sessões de chat.
  releaseAll(): void {
    new Set(this.sessions.values()).forEach((s) => {
      if (s.remoteOn) return
      if (!s.busy) this.closeSession(s)
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

  // Uma entrada por sessão aberta (a mesma sessão aparece em várias chaves).
  list(): { id: string; cwd: string; state: ChatState }[] {
    return [...new Set(this.sessions.values())].map((s) => ({ id: [...s.keys][0], cwd: s.cwd, state: s.state }))
  }

  has(key: string): boolean {
    return this.sessions.has(key)
  }

  send(req: ChatSendRequest): void {
    this.open(req).send(req)
  }

  remoteControl(req: ChatRemoteRequest): void {
    // Desligar sem sessão aberta: não há o que desligar.
    if (!req.enabled && !this.find(req)) return
    void this.open(req).remoteControl(req.enabled)
  }

  private find(req: { key: string; sessionId?: string }): ChatSession | undefined {
    return this.sessions.get(req.key) ?? (req.sessionId ? this.sessions.get(req.sessionId) : undefined)
  }

  // Sessão da conversa, aberta agora se ainda não existe.
  private open(req: Omit<ChatSendRequest, 'text' | 'images'>): ChatSession {
    let session = this.find(req)
    if (!session) {
      session = new ChatSession(
        req.key,
        req,
        (s) => {
          s.keys.forEach((k) => this.onState(k, s.state))
          // Fechada na tela e o Claude parou: encerra agora, sem deixar processo aberto.
          if (s.closeWhenIdle && !s.busy) this.closeSession(s)
        },
        (s) => s.keys.forEach((k) => this.sessions.get(k) === s && this.sessions.delete(k)),
        (s, id) => {
          s.keys.add(id)
          this.sessions.set(id, s)
        }
      )
      this.sessions.set(req.key, session)
    }
    return session
  }

  answer(key: string, id: string, answer: PermissionAnswer): void {
    this.sessions.get(key)?.answer(id, answer)
  }

  // Conversa aberta responde pela própria sessão; sem ela, uma consulta avulsa.
  async mcpStatus(key: string, cwd: string): Promise<McpStatus> {
    try {
      const session = this.sessions.get(key)
      return { ok: true, servers: session ? await session.mcpServers() : await mcpStatusFor(cwd) }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
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
