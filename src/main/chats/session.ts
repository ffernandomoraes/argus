import { randomUUID } from 'node:crypto'
import { query, type Query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import type { ChatSendRequest, ChatSettings, ChatState, PermissionAnswer } from '../../shared/chat'
import type { McpServer } from '../../shared/mcp'
import { resolveAccount } from '../accounts'
import { learnContextWindow } from '../contextWindows'
import { claudeCodeOptions } from './env'
import { Inbox } from './inbox'
import { mcpServersOf } from './mcpStatus'
import { friendlyError, userMessage } from './messages'
import { PendingPermissions } from './permissions'
import { QueuedSends } from './queuedSends'
import { setRemoteControl } from './remote'
import { flagChanges, mergeSettings, openingFlags, toPermissionMode } from './settings'
import { newReader, readMessage, type Reader } from './stream'

// O que a sessão avisa ao registro (Chats).
export type SessionEvents = {
  // Estado novo da conversa. Único ponto de emissão (ver flush).
  changed: (session: ChatSession) => void
  // Nada mudou na tela, mas a sessão pode ter ficado livre para fechar.
  settled: (session: ChatSession) => void
  // O Claude informou o id da sessão: vira mais uma chave.
  identified: (session: ChatSession, id: string) => void
  // O processo do Claude terminou.
  ended: (session: ChatSession) => void
}

export type OpenRequest = Omit<ChatSendRequest, 'text' | 'images'>

// Texto chegando aos pedaços: junta para não redesenhar a cada letra.
const FLUSH_MS = 50

// Sem pedido em andamento.
const STOPPED = { status: 'idle', turnStartedAt: undefined } as const

export class ChatSession {
  readonly keys = new Set<string>()
  readonly cwd: string
  // Conta com que a sessão abriu. Trocar a do grupo não mexe nela: a próxima abertura já usa a nova.
  readonly account: string
  // Conversa já fechada na tela: encerrar assim que o Claude parar.
  closeWhenIdle = false
  // Fechada na tela com o remote control ligado: encerrar quando ele cair ou for desligado.
  keepForRemote = false
  state: ChatState = { status: 'idle', partial: '', permissions: [], revision: 0, turnTokens: 0, agents: [] }
  // Parada pedida por você: o fim do pedido não é erro.
  private interrupted = false
  // Parada com mensagem sua que continua na fila do Claude: o fim do pedido parado emenda no seguinte.
  private resumes = false
  // Configurações em vigor, para mandar o ultracode junto quando o esforço muda (ver flagChanges).
  private settings: ChatSettings
  private inbox = new Inbox()
  private q: Query
  private reader: Reader = newReader()
  private flushTimer: NodeJS.Timeout | null = null
  private permissions = new PendingPermissions(
    (request) => this.update({ status: 'needs-you', permissions: [...this.state.permissions, request] }),
    (id) => this.dropPermission(id)
  )
  private queued = new QueuedSends(() => this.queueDrained())

  constructor(
    key: string,
    req: OpenRequest,
    private events: SessionEvents
  ) {
    this.keys.add(key)
    this.cwd = req.cwd
    this.account = resolveAccount(req.account)
    this.settings = req.settings
    const s = req.settings
    this.q = query({
      prompt: this.inbox,
      options: {
        ...claudeCodeOptions(req.cwd, this.account),
        includePartialMessages: true,
        resume: req.sessionId,
        model: s.model || undefined,
        effort: (s.effort || undefined) as never,
        permissionMode: toPermissionMode(s.permissionMode),
        // Sem isso o SDK recusa o "Ignorar permissões", na abertura e na troca com a conversa aberta.
        allowDangerouslySkipPermissions: true,
        settings: openingFlags(s) as never,
        // Cada subagente manda uma frase do que está fazendo agora; aparece no ramo dele no canvas.
        agentProgressSummaries: true,
        canUseTool: this.permissions.canUseTool
      }
    })
    void this.run()
  }

  private update(patch: Partial<ChatState>, now = true): void {
    this.state = { ...this.state, ...patch }
    if (now) this.flush()
    else this.flushTimer ??= setTimeout(() => this.flush(), FLUSH_MS)
  }

  private flush(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer)
    this.flushTimer = null
    this.events.changed(this)
  }

  private dropPermission(id: string): void {
    const permissions = this.state.permissions.filter((p) => p.id !== id)
    this.update({ permissions, status: permissions.length ? 'needs-you' : this.state.status === 'idle' ? 'idle' : 'running' })
  }

  answer(id: string, answer: PermissionAnswer): void {
    this.permissions.answer(id, answer)
  }

  send(req: ChatSendRequest): void {
    const uuid = randomUUID()
    // Com o Claude no meio de um pedido (ou terminando um que você parou), a mensagem espera na
    // fila dele. Durante a parada ela roda logo depois do pedido parado.
    if (this.state.status !== 'idle' || this.interrupted) this.queued.add(uuid)
    if (this.interrupted) this.resumes = true
    this.inbox.push(userMessage(req, uuid))
    // Mensagem nova com o Claude parado começa a contagem de tempo e tokens.
    const fresh = this.state.status === 'idle' || !this.state.turnStartedAt
    if (fresh) this.reader = { ...this.reader, closedTokens: 0, currentTokens: 0 }
    this.update({
      // Permissão esperando resposta continua precisando de você.
      status: this.permissions.size ? 'needs-you' : 'running',
      error: undefined,
      ...(fresh && { turnStartedAt: Date.now(), turnTokens: 0 })
    })
  }

  // Liga ou desliga o remote control. Ligado, a sessão continua de pé com a conversa fechada
  // na tela (ver Chats.release), para seguir respondendo pelo celular.
  async remoteControl(enabled: boolean): Promise<void> {
    if (enabled) this.update({ remote: { status: 'connecting' } })
    try {
      const url = await setRemoteControl(this.q, enabled)
      if (!enabled) return this.update({ remote: undefined })
      this.update({ remote: { status: 'connecting', ...this.state.remote, url } })
    } catch (err) {
      this.update({ remote: enabled ? { status: 'failed', detail: (err as Error).message } : this.state.remote })
    }
  }

  // Trabalhando: respondendo, com subagente em segundo plano ainda rodando, ou com mensagem sua
  // esperando na fila do Claude.
  get busy(): boolean {
    return this.state.status !== 'idle' || this.state.agents.length > 0 || this.queued.size > 0
  }

  get remoteOn(): boolean {
    return !!this.state.remote && this.state.remote.status !== 'failed'
  }

  // Ninguém precisa mais dela: fechada na tela e parada, ou mantida só pelo remote control e ele caiu.
  get readyToClose(): boolean {
    return !this.busy && (this.closeWhenIdle || (this.keepForRemote && !this.remoteOn))
  }

  mcpServers(): Promise<McpServer[]> {
    return mcpServersOf(this.q)
  }

  async interrupt(): Promise<void> {
    if (this.state.status !== 'idle') this.interrupted = true
    // Mensagem sua na fila pode sobreviver à parada e rodar em seguida, e quem diz é o recibo do
    // Claude (still_queued). Sem nenhuma, a tela reage na hora, sem esperar o Claude confirmar.
    const askReceipt = this.interrupted && this.queued.size > 0
    this.update({ partial: '', error: undefined, activity: undefined, ...(!askReceipt && STOPPED) })
    let receipt: Awaited<ReturnType<Query['interrupt']>>
    try {
      receipt = await this.q.interrupt()
    } catch {
      // já parado
    }
    // Nada na fila para conferir, ou o fim do pedido parado já chegou e decidiu o status.
    if (!askReceipt || !this.interrupted) return
    if (receipt?.still_queued.some((id) => this.queued.has(id))) {
      this.resumes = true
      return
    }
    // CLI antigo não manda recibo: a mensagem continua contando como na fila até o próximo pedido.
    if (receipt) this.queued.clear()
    this.update(STOPPED)
  }

  // Mudanças feitas nos seletores com a conversa aberta.
  async configure(patch: Partial<ChatSettings>): Promise<void> {
    const flags = flagChanges(patch, this.settings)
    // Guardadas já: outra troca logo em seguida parte destas.
    this.settings = mergeSettings(this.settings, patch)
    try {
      if (patch.model !== undefined) await this.q.setModel(patch.model || undefined)
      if (patch.permissionMode !== undefined) {
        await this.q.setPermissionMode(toPermissionMode(patch.permissionMode) ?? 'default')
      }
      if (Object.keys(flags).length) await this.q.applyFlagSettings(flags as never)
    } catch (err) {
      this.update({ error: `Não consegui aplicar a mudança: ${(err as Error).message}` })
    }
  }

  close(): void {
    this.permissions.denyAll('Conversa fechada.')
    this.queued.clear()
    this.inbox.close()
    this.q.close()
  }

  // Ninguém mais na fila do Claude. Parada com mensagem que acabou não rodando: não há mais o que
  // esperar. Senão, a conversa pode ter ficado livre para fechar.
  private queueDrained(): void {
    if (this.state.status === 'running' && !this.state.turnStartedAt) this.update(STOPPED)
    else this.events.settled(this)
  }

  private async run(): Promise<void> {
    try {
      for await (const m of this.q) {
        try {
          this.read(m)
        } catch (err) {
          // Mensagem num formato inesperado não derruba a conversa: fica no registro e segue.
          console.error('[chat] mensagem do Claude não lida:', m.type, err)
        }
      }
    } catch (err) {
      this.update({ error: friendlyError((err as Error).message) })
    } finally {
      this.queued.clear()
      this.update({
        status: 'idle',
        partial: '',
        permissions: [],
        agents: [],
        activity: undefined,
        revision: this.state.revision + 1
      })
      this.events.ended(this)
    }
  }

  private read(m: SDKMessage): void {
    this.queued.touch()
    const step = readMessage(m, this.state, this.reader, {
      now: Date.now(),
      waiting: this.permissions.size,
      interrupted: this.interrupted,
      // Só emenda se ainda houver mensagem sua na fila (parar de novo no intervalo já a consumiu).
      resumes: this.resumes && this.queued.size > 0
    })
    this.reader = step.reader
    if (step.sessionId) this.events.identified(this, step.sessionId)
    step.contextWindows?.forEach(([model, tokens]) => learnContextWindow(model, tokens))
    if (step.turnStarted) this.queued.started()
    if (step.turnEnded) {
      this.interrupted = false
      this.resumes = false
    }
    if (step.patch) this.update(step.patch, !!step.urgent)
    if (step.turnEnded) this.queued.ended()
  }
}
