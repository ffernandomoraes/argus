import { randomUUID } from 'node:crypto'
import type { ChatSendRequest, ChatSettings, ChatState, PermissionAnswer, PermissionRequest, QueuedMessage } from '../../shared/chat'
import type { Message } from '../../shared/history'
import type { McpServer } from '../../shared/mcp'
import type { AgentRef } from '../../shared/providers'
import { tr } from '../i18n'
import { expandHome } from '../paths'
import { AcpDriver } from './acp'
import { CodexDriver } from './codex'
import type { Driver, DriverEvents, PermissionReply, ToolEvent } from './driver'
import { sanitizeSettings } from './models'
import { loadConversation, saveConversation, saveImages, type StoredConversation } from './store'

// Conversa com Codex, Gemini ou Cursor, com as mesmas operações da do Claude (chats/session.ts):
// o registro de conversas (chats/index.ts), a tela e as notificações tratam as duas igual.
// O histórico é o do Argus (store.ts): cada mensagem, raciocínio e ferramenta entra no arquivo da
// conversa assim que termina, e a tela relê quando a revisão sobe.

export type AgentSessionEvents = {
  changed: (session: AgentChatSession) => void
  identified: (session: AgentChatSession, id: string) => void
  ended: (session: AgentChatSession) => void
}

type OpenRequest = Omit<ChatSendRequest, 'text' | 'images'>

const FLUSH_MS = 50
// Pedido sem nenhum sinal do agente nesse tempo: o chat explica o provável motivo, sem cancelar.
const SILENCE_MS = 45_000
const STOPPED = { status: 'idle', turnStartedAt: undefined, activity: undefined } as const

const titleOf = (text: string) => {
  const line = text.trim().split('\n')[0] ?? ''
  return line.length > 60 ? line.slice(0, 60) + '…' : line
}

export class AgentChatSession {
  readonly keys = new Set<string>()
  readonly cwd: string
  // Referência completa ("codex:main"), no mesmo campo da conta do Claude.
  readonly account: string
  closeWhenIdle = false
  keepForRemote = false
  state: ChatState = { status: 'idle', partial: '', permissions: [], revision: 0, turnTokens: 0, agents: [], backgroundTasks: 0 }
  private conversation: StoredConversation
  private driver: Driver | null = null
  private starting: Promise<void> | null = null
  private settings: ChatSettings
  // Outras pastas do workspace (ver workspaceFolders.ts).
  private folders: string[]
  // Mensagens enviadas com o agente trabalhando: entram no histórico quando chega a vez delas.
  private queue: (QueuedMessage & { prompt: string; images: ChatSendRequest['images']; message: Message })[] = []
  private running = false
  private interrupted = false
  private thought = ''
  private pending = new Map<string, (reply: PermissionReply) => void>()
  private flushTimer: NodeJS.Timeout | null = null
  private saveTimer: NodeJS.Timeout | null = null
  private identified = false
  private silenceTimer: NodeJS.Timeout | undefined

  constructor(
    key: string,
    req: OpenRequest,
    private ref: AgentRef,
    private events: AgentSessionEvents
  ) {
    this.keys.add(key)
    this.cwd = req.cwd
    this.folders = req.folders ?? []
    this.settings = req.settings
    const stored = req.sessionId ? loadConversation(req.sessionId) : null
    this.ref = stored ? { provider: stored.provider, account: stored.account } : ref
    this.account = `${this.ref.provider}:${this.ref.account}`
    this.state = { ...this.state, agent: this.account }
    const now = new Date().toISOString()
    this.conversation = stored ?? {
      version: 1,
      id: randomUUID(),
      provider: this.ref.provider,
      account: this.ref.account,
      cwd: req.cwd,
      title: '',
      createdAt: now,
      updatedAt: now,
      contextPercent: 0,
      messages: []
    }
    if (stored) {
      this.identified = true
      this.state = { ...this.state, sessionId: stored.id }
    }
  }

  get id(): string {
    return this.conversation.id
  }

  get busy(): boolean {
    return this.running || this.queue.length > 0 || this.state.status !== 'idle'
  }

  get remoteOn(): boolean {
    return false
  }

  get readyToClose(): boolean {
    return !this.busy && this.closeWhenIdle
  }

  async mcpServers(): Promise<McpServer[]> {
    return []
  }

  // Os MCPs dos outros agentes não aparecem no painel: não há o que reconectar.
  async reconnectMcp(): Promise<void> {}

  // Remote control é do Claude Code.
  async remoteControl(): Promise<void> {
    this.update({ remote: { status: 'failed', detail: tr('Só o Claude tem remote control.', 'Only Claude has remote control.') } })
  }

  send(req: ChatSendRequest): void {
    const id = randomUUID()
    const at = new Date().toISOString()
    const user: Message = { id, role: 'user', text: req.text, at, ...(req.images.length && { images: req.images.length }) }
    if (!this.conversation.title) this.conversation.title = titleOf(req.text)
    // O aviso oculto (agentes chamados com @nome, regras do orquestrador) vai junto no pedido, sem
    // aparecer no balão.
    const prompt = req.hint ? `${req.text}\n\n${req.hint}` : req.text
    if (!this.identified) {
      this.identified = true
      this.update({ sessionId: this.conversation.id })
      this.events.identified(this, this.conversation.id)
    }
    saveImages(this.conversation.id, id, req.images.map((i) => `data:${i.mediaType};base64,${i.data}`))
    if (this.running) {
      this.queue.push({ id, text: req.text, at: Date.now(), prompt, images: req.images, message: user })
      this.update({})
      return
    }
    this.pushMessage(user)
    void this.run(prompt, req.images)
  }

  answer(id: string, answer: PermissionAnswer): void {
    const resolve = this.pending.get(id)
    if (!resolve) return
    this.pending.delete(id)
    resolve(answer === 'always' ? 'always' : answer === 'allow' ? 'allow' : 'deny')
    const permissions = this.state.permissions.filter((p) => p.id !== id)
    this.update({ permissions, status: permissions.length ? 'needs-you' : 'running' })
  }

  async interrupt(): Promise<void> {
    if (!this.running) return
    // Mensagem sua na fila continua: roda logo depois do pedido parado, como no Claude.
    this.interrupted = true
    this.denyAll()
    this.update({ partial: '', activity: undefined })
    await this.driver?.cancel()
  }

  async configure(patch: Partial<ChatSettings>): Promise<void> {
    this.settings = await sanitizeSettings(this.ref, { ...this.settings, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) })
    try {
      await this.driver?.configure(this.settings)
    } catch (err) {
      this.update({ error: tr(`Não consegui aplicar a mudança: ${(err as Error).message}`, `Couldn't apply the change: ${(err as Error).message}`) })
    }
  }

  close(): void {
    this.heard()
    this.denyAll()
    this.queue = []
    this.save(true)
    this.driver?.close()
    this.driver = null
  }

  private async ensureDriver(): Promise<void> {
    if (this.driver) return
    this.starting ??= (async () => {
      this.settings = await sanitizeSettings(this.ref, this.settings)
      const driver: Driver =
        this.ref.provider === 'codex'
          ? new CodexDriver(this.ref.account, expandHome(this.cwd), this.settings, this.driverEvents(), this.folders)
          : new AcpDriver(this.ref.provider, this.ref.account, expandHome(this.cwd), this.settings, this.driverEvents(), this.folders)
      try {
        this.conversation.nativeId = await driver.start(this.conversation.nativeId)
        this.driver = driver
      } catch (err) {
        driver.close()
        throw err
      }
    })().finally(() => (this.starting = null))
    return this.starting
  }

  private async run(prompt: string, images: ChatSendRequest['images']): Promise<void> {
    this.running = true
    this.interrupted = false
    this.update({ status: 'running', error: undefined, turnStartedAt: Date.now(), turnTokens: 0, activity: { kind: 'thinking', since: Date.now() } })
    this.watchSilence()
    try {
      await this.ensureDriver()
      await this.driver!.prompt({ text: prompt, images })
    } catch (err) {
      if (!this.interrupted) this.update({ error: (err as Error).message || tr('O agente não respondeu.', 'The agent didn’t answer.') })
    }
    this.heard()
    this.commitThought()
    this.commitText()
    if (this.interrupted) this.pushMessage({ id: randomUUID(), role: 'event', kind: 'interrupted', text: tr('Interrompido', 'Interrupted'), at: new Date().toISOString() })
    this.running = false
    this.denyAll()
    const next = this.queue.shift()
    if (next) {
      this.interrupted = false
      this.pushMessage(next.message)
      this.update({})
      void this.run(next.prompt, next.images)
      return
    }
    this.interrupted = false
    this.save(true)
    this.update({ ...STOPPED, partial: '', permissions: [], revision: this.state.revision + 1 })
    if (this.readyToClose) this.events.changed(this)
  }

  // O Gemini com uma chave sem cota para o modelo fica tentando de novo sem avisar nada.
  private watchSilence(): void {
    clearTimeout(this.silenceTimer)
    this.silenceTimer = setTimeout(() => {
      const notice =
        this.ref.provider === 'gemini'
          ? tr(
              'O Gemini ainda não respondeu. Com a chave do plano gratuito do Google, alguns modelos ficam sem cota e ele fica tentando de novo. Pare e escolha o Gemini 3 Flash no seletor de modelo, ou ative o faturamento no Google AI Studio.',
              'Gemini hasn’t answered yet. With a free-tier Google key, some models have no quota and it keeps retrying. Stop and pick Gemini 3 Flash in the model picker, or enable billing in Google AI Studio.'
            )
          : tr('O agente ainda não respondeu. Ele continua tentando; você pode parar e mandar de novo.', 'The agent hasn’t answered yet. It keeps trying; you can stop and send again.')
      this.update({ error: notice })
    }, SILENCE_MS)
  }

  // Qualquer sinal do agente: o aviso de silêncio sai (e o relógio dele para).
  private heard(): void {
    clearTimeout(this.silenceTimer)
    this.silenceTimer = undefined
  }

  // Os avisos do agente; texto, raciocínio, ferramenta ou pergunta contam como sinal de vida.
  private driverEvents(): DriverEvents {
    const e = this.handlers()
    const alive = () => {
      if (!this.silenceTimer) return
      this.heard()
      if (this.state.error) this.update({ error: undefined }, false)
    }
    return {
      ...e,
      text: (d) => (alive(), e.text(d)),
      thought: (d) => (alive(), e.thought(d)),
      tool: (t) => (alive(), e.tool(t)),
      permission: (ask) => (alive(), e.permission(ask))
    }
  }

  private handlers(): DriverEvents {
    return {
      text: (delta) => {
        if (this.thought) this.commitThought()
        this.update({ partial: this.state.partial + delta, activity: { kind: 'writing', since: this.state.activity?.kind === 'writing' ? this.state.activity.since : Date.now() } }, false)
      },
      textDone: () => this.commitText(),
      thought: (delta) => {
        this.thought += delta
        if (this.state.activity?.kind !== 'thinking') this.update({ activity: { kind: 'thinking', since: Date.now() } }, false)
      },
      thoughtDone: () => this.commitThought(),
      tool: (t) => this.upsertTool(t),
      permission: (ask) =>
        new Promise<PermissionReply>((resolve) => {
          const id = randomUUID()
          this.pending.set(id, resolve)
          const request: PermissionRequest = { id, ...ask }
          this.update({ status: 'needs-you', permissions: [...this.state.permissions, request] })
        }),
      title: (title) => {
        this.conversation.title = title
        this.save()
      },
      usage: ({ contextPercent, turnTokens }) => {
        if (contextPercent !== undefined) this.conversation.contextPercent = contextPercent
        this.update({ ...(turnTokens !== undefined && { turnTokens: this.state.turnTokens + turnTokens }) }, false)
      },
      exited: (reason) => {
        this.driver = null
        if (this.running && !this.interrupted && reason) this.update({ error: reason })
      }
    }
  }

  private commitText(): void {
    const text = this.state.partial
    if (!text.trim()) return
    this.pushMessage({ id: randomUUID(), role: 'assistant', text, at: new Date().toISOString() })
    this.update({ partial: '' })
  }

  private commitThought(): void {
    const text = this.thought
    this.thought = ''
    if (text.trim()) this.pushMessage({ id: randomUUID(), role: 'thinking', text, at: new Date().toISOString() })
  }

  private upsertTool(t: ToolEvent): void {
    this.commitText()
    const messages = this.conversation.messages
    const i = messages.findIndex((m) => m.role === 'tool' && m.toolUseId === t.id)
    const message: Message = {
      id: i >= 0 ? messages[i].id : randomUUID(),
      role: 'tool',
      at: i >= 0 ? messages[i].at : new Date().toISOString(),
      name: t.name,
      label: t.label,
      input: t.input,
      detail: t.detail,
      result: t.result ?? '',
      error: t.error || undefined,
      diff: t.diff,
      toolUseId: t.id
    }
    if (i >= 0) messages[i] = message
    else messages.push(message)
    this.update({ activity: t.done ? { kind: 'thinking', since: Date.now() } : { kind: 'running', tool: t.label, summary: t.input, since: Date.now() } }, false)
    this.save()
  }

  private pushMessage(m: Message): void {
    this.conversation.messages.push(m)
    this.save()
  }

  // Grava e avisa a tela para reler. Em rajada (várias ferramentas seguidas), junta.
  private save(now = false): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = null
    const write = () => {
      this.saveTimer = null
      this.conversation.updatedAt = new Date().toISOString()
      saveConversation(this.conversation)
      this.update({ revision: this.state.revision + 1 })
    }
    if (now) write()
    else this.saveTimer = setTimeout(write, 120)
  }

  private denyAll(): void {
    this.pending.forEach((resolve) => resolve('deny'))
    this.pending.clear()
    if (this.state.permissions.length) this.update({ permissions: [] })
  }

  private update(patch: Partial<ChatState>, now = true): void {
    this.state = { ...this.state, ...patch, queued: this.queue.map(({ id, text, at }) => ({ id, text, at })) }
    if (now) this.flush()
    else this.flushTimer ??= setTimeout(() => this.flush(), FLUSH_MS)
  }

  private flush(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer)
    this.flushTimer = null
    this.events.changed(this)
  }
}
