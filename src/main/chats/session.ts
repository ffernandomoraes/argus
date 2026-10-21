import { randomUUID } from 'node:crypto'
import { query, type Query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import type { ChatSendRequest, ChatSettings, ChatState, PermissionAnswer } from '../../shared/chat'
import type { McpAuthResult, McpServer } from '../../shared/mcp'
import { resolveAccount } from '../accounts'
import { learnContextWindow } from '../contextWindows'
import { tr } from '../i18n'
import { ARGUS_ALLOWED_TOOLS, ARGUS_MCP, argusMcp } from '../terminals/drawerShells'
import { claudeCodeOptions } from './env'
import { Inbox } from './inbox'
import { authenticateMcp, clearMcpAuth, mcpServersOf } from './mcpStatus'
import { friendlyError, userMessage } from './messages'
import { PendingPermissions } from './permissions'
import { QueuedSends } from './queuedSends'
import { setRemoteControl } from './remote'
import { flagChanges, mergeSettings, openingFlags, toPermissionMode } from './settings'
import { newReader, readMessage, type Reader, type SessionState } from './stream'

// O que a sessão avisa ao registro (Chats).
export type SessionEvents = {
  // Estado novo da conversa. Único ponto de emissão (ver flush).
  changed: (session: ChatSession) => void
  // O Claude informou o id da sessão: vira mais uma chave.
  identified: (session: ChatSession, id: string) => void
  // O processo do Claude terminou.
  ended: (session: ChatSession) => void
}

export type OpenRequest = Omit<ChatSendRequest, 'text' | 'images'>

// Texto chegando aos pedaços: junta para não redesenhar a cada letra.
const FLUSH_MS = 50

// Prévia da resposta que continua depois do fim do pedido. A tela relê o histórico com a resposta
// gravada sem esperar, mas não na hora: zerar junto com o fim fazia a resposta sumir por um
// instante, a conversa encolher e a rolagem pular. Depois disso sai de vez (pedido cortado, que o
// histórico nunca traz igual).
const PARTIAL_HOLD_MS = 3_000

// Sem pedido em andamento.
const STOPPED = { status: 'idle', turnStartedAt: undefined } as const

// Tarefa em segundo plano que terminou: o Claude Code entrega o aviso num pedido novo, logo em
// seguida. Fechar a conversa nesse intervalo matava o pedido, e a resposta só vinha na sua próxima
// mensagem. Quem diz que o pedido começou é o session_state "running", que chega logo depois do fim
// da tarefa; o prazo é só a rede de segurança para um aviso que não vire pedido (ou CLI antigo).
// Qualquer notícia do Claude nesse meio-tempo recomeça a conta.
const WAKE_GRACE_MS = 60_000

const backgroundWork = (s: ChatState): number => s.agents.filter((a) => a.background).length + s.backgroundTasks

export class ChatSession {
  readonly keys = new Set<string>()
  readonly cwd: string
  // Conta com que a sessão abriu. Trocar a do grupo não mexe nela: a próxima abertura já usa a nova.
  readonly account: string
  // Conversa já fechada na tela: encerrar assim que o Claude parar.
  closeWhenIdle = false
  // Fechada na tela com o remote control ligado: encerrar quando ele cair ou for desligado.
  keepForRemote = false
  state: ChatState = { status: 'idle', partial: '', permissions: [], revision: 0, turnTokens: 0, agents: [], backgroundTasks: 0 }
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
  private partialTimer: NodeJS.Timeout | undefined
  // Esperando o pedido que entrega o aviso da tarefa em segundo plano (ver WAKE_GRACE_MS).
  private wakeTimer: NodeJS.Timeout | undefined
  // O que o próprio Claude Code diz (session_state): só "idle" é parado de verdade, já sem pedido
  // nem aviso de tarefa por entregar.
  private claudeState: SessionState = 'idle'
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
    const options = claudeCodeOptions(req.cwd, this.account, req.folders)
    this.q = query({
      prompt: this.inbox,
      options: {
        ...options,
        // Sem isso o Claude Code não manda o session_state (ver claudeState).
        env: { ...options.env, CLAUDE_CODE_EMIT_SESSION_STATE_EVENTS: '1' },
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
        // Ao fim de cada pedido, a próxima mensagem provável vira um balão clicável no chat. Usa o
        // cache da conversa (quase de graça); quem desligou no settings.json do Claude Code não recebe.
        promptSuggestions: true,
        canUseTool: this.permissions.canUseTool,
        // Ferramentas do próprio Argus (digitar no terminal do drawer), junto dos MCPs da pessoa.
        mcpServers: { [ARGUS_MCP]: argusMcp(() => this.keys) },
        allowedTools: ARGUS_ALLOWED_TOOLS
      }
    })
    void this.run()
  }

  // A fila vai junto de todo estado novo: quem mexe nela sempre emite um em seguida.
  private update(patch: Partial<ChatState>, now = true): void {
    this.state = { ...this.state, ...patch, queued: this.queued.list() }
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
    if (this.state.status !== 'idle' || this.interrupted) this.queued.add({ id: uuid, text: req.text, at: Date.now() })
    if (this.interrupted) this.resumes = true
    this.inbox.push(userMessage(req, uuid))
    // Mensagem nova com o Claude parado começa a contagem de tempo e tokens.
    const fresh = this.state.status === 'idle' || !this.state.turnStartedAt
    if (fresh) this.reader = { ...this.reader, closedTokens: 0, currentTokens: 0 }
    this.update({
      // Permissão esperando resposta continua precisando de você.
      status: this.permissions.size ? 'needs-you' : 'running',
      error: undefined,
      suggestion: undefined,
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

  // Trabalhando: respondendo, com subagente ou comando em segundo plano ainda rodando (ou que acabou
  // de terminar e o aviso ainda vai chegar), ou com mensagem sua esperando na fila do Claude.
  get busy(): boolean {
    return (
      this.state.status !== 'idle' ||
      this.state.agents.length > 0 ||
      this.state.backgroundTasks > 0 ||
      this.queued.size > 0 ||
      this.claudeState !== 'idle' ||
      !!this.wakeTimer
    )
  }

  get remoteOn(): boolean {
    return !!this.state.remote && this.state.remote.status !== 'failed'
  }

  // Ninguém precisa mais dela: fechada na tela e parada, ou mantida só pelo remote control e ele caiu.
  get readyToClose(): boolean {
    return !this.busy && (this.closeWhenIdle || (this.keepForRemote && !this.remoteOn))
  }

  mcpServers(wait = true): Promise<McpServer[]> {
    return mcpServersOf(this.q, wait)
  }

  // Reconecta um servidor MCP desta sessão (o "Reconectar" do painel, como no VS Code).
  reconnectMcp(name: string): Promise<void> {
    return this.q.reconnectMcpServer(name)
  }

  // "Autorizar" e "Desconectar" do painel (ver mcpStatus.ts).
  authenticateMcp(name: string): Promise<McpAuthResult> {
    return authenticateMcp(this.q, name)
  }

  clearMcpAuth(name: string): Promise<void> {
    return clearMcpAuth(this.q, name)
  }

  // /output-style: o Claude Code grava no settings.local.json da pasta e já aplica aqui.
  async outputStyle(): Promise<string> {
    return (await this.q.initializationResult()).output_style
  }

  setOutputStyle(style: string): Promise<void> {
    return this.q.updateSettings('localSettings', { outputStyle: style })
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
      const reason = (err as Error).message
      this.update({ error: tr(`Não consegui aplicar a mudança: ${reason}`, `Couldn't apply the change: ${reason}`) })
    }
  }

  close(): void {
    clearTimeout(this.partialTimer)
    this.stopWaitingWake()
    this.permissions.denyAll('Conversa fechada.')
    this.queued.clear()
    this.inbox.close()
    this.q.close()
  }

  // Ninguém mais na fila do Claude. Parada com mensagem que acabou não rodando: não há mais o que
  // esperar. Em todo caso o balão sai, e a conversa pode ter ficado livre para fechar.
  private queueDrained(): void {
    this.update(this.state.status === 'running' && !this.state.turnStartedAt ? STOPPED : {})
  }

  // Segura a sessão até o pedido do aviso começar. Sem pedido nesse tempo, nada mais a esperar, e a
  // conversa pode ter ficado livre para fechar.
  private expectWake(): void {
    clearTimeout(this.wakeTimer)
    this.wakeTimer = setTimeout(() => {
      this.wakeTimer = undefined
      this.update({})
    }, WAKE_GRACE_MS)
  }

  private stopWaitingWake(): void {
    clearTimeout(this.wakeTimer)
    this.wakeTimer = undefined
  }

  private dropPartialSoon(): void {
    const held = this.state.partial
    if (!held) return
    // Resposta nova já escrevendo nesse meio-tempo: a prévia é outra e fica.
    clearTimeout(this.partialTimer)
    this.partialTimer = setTimeout(() => this.state.partial === held && this.update({ partial: '' }), PARTIAL_HOLD_MS)
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
      this.stopWaitingWake()
      this.claudeState = 'idle'
      this.update({
        status: 'idle',
        partial: '',
        permissions: [],
        agents: [],
        backgroundTasks: 0,
        backgroundStarts: undefined,
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
    // Antes do update: com a tarefa saindo da lista a sessão já pareceria livre e fecharia ali.
    const finished = !!step.patch && backgroundWork({ ...this.state, ...step.patch }) < backgroundWork(this.state)
    if (finished || this.wakeTimer) this.expectWake()
    if (step.sessionState) {
      this.claudeState = step.sessionState
      // Pedido do aviso começou: daqui quem segura a sessão é o próprio estado.
      if (step.sessionState !== 'idle') this.stopWaitingWake()
    }
    if (step.turnStarted) {
      this.queued.started()
      this.stopWaitingWake()
    }
    if (step.turnEnded) {
      this.interrupted = false
      this.resumes = false
    }
    if (step.patch) this.update(step.patch, !!step.urgent)
    if (step.turnEnded) {
      this.queued.ended()
      this.dropPartialSoon()
    }
  }
}
