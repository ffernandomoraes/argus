import type { ChatRemoteRequest, ChatSendRequest, ChatSettings, ChatState, OutputStyleStatus, PermissionAnswer } from '../../shared/chat'
import type { McpAuthResult, McpStatus } from '../../shared/mcp'
import type { ChatEntry } from './entries'
import { AccountMcp } from './accountMcp'
import { mcpStatusFor, removeMcp } from './mcpStatus'
import { readOutputStyle, writeOutputStyle } from './outputStyle'
import { parseAgentRef, type AgentRef } from '../../shared/providers'
import { AgentChatSession } from '../agentChats/session'
import { indexEntry, isAgentConversation, samePath } from '../agentChats/store'
import { ChatSession, type OpenRequest } from './session'
import { memoryTight } from './systemMemory'
import { resolveAccount } from '../accounts'
import { tr } from '../i18n'

// Conversa do Claude (SDK) ou de outro agente (Codex, Gemini, Cursor; ver agentChats/): as duas têm
// as mesmas operações.
type AnySession = ChatSession | AgentChatSession

type Events = {
  changed: (s: AnySession) => void
  identified: (s: AnySession, id: string) => void
  ended: (s: AnySession) => void
}

// Quem roda a conversa: uma já gravada continua com o agente dela, seja qual for o do grupo agora;
// uma nova usa o do grupo. Nulo: o Claude.
function agentFor(req: OpenRequest): AgentRef | null {
  if (req.sessionId) {
    const entry = isAgentConversation(req.sessionId) ? indexEntry(req.sessionId) : undefined
    return entry ? { provider: entry.provider, account: entry.account } : null
  }
  return parseAgentRef(req.account)
}

export { claudeEnv, claudeLaunch, claudeProcess } from './env'
export { Inbox } from './inbox'
export type { ChatEntry } from './entries'

// Conversa fechada na tela continua com a sessão aberta por um tempo: no canvas a pessoa troca de
// conversa, de painel e de projeto o tempo todo, e lê com calma uma resposta grande antes de
// voltar; voltar nela não pode custar reabrir o agente. (O VS Code encerra na hora, ao fechar a aba.)
const RELEASE_DELAY_MS = 10 * 60_000
// Fechadas na tela esperando o prazo, no máximo estas: além disso, a fechada há mais tempo encerra.
// Eram 10 por 20 minutos: até ~5,5 GB parados, e o aviso de memória do macOS chega tarde (com 62%
// "livre", já havia 3 GB comprimidos e 1 GB em swap), então o computador engasgava antes.
const MAX_RELEASING = 3
// Cada sessão parada não gasta CPU, mas ocupa memória: medido em 2026-10-14, ~300 MB do Claude
// mais os servidores MCP globais da pessoa (~550 MB no total aqui). Com o computador apertado de
// memória (systemMemory.ts), as sessões fechadas na tela encerram antes do prazo, da fechada há mais
// tempo para a mais nova, uma de cada vez, até a máquina sair do aperto. Com folga, nada encerra
// antes: máquina mais forte aguenta mais. As abertas na tela e as que estão trabalhando nunca entram.
// Com sessão esperando, a memória é conferida a cada minuto; depois de encerrar uma, de novo pouco
// depois (o processo leva um instante para sair e o sistema, para recuperar a memória).
const MEMORY_CHECK_MS = 60_000
const MEMORY_SETTLE_MS = 10_000

// Uma sessão do Claude por conversa aberta no chat. A chave é o id da conversa no app;
// conversa nova ganha também o id da sessão como chave, assim que o Claude informa.
export class Chats {
  private sessions = new Map<string, AnySession>()
  // MCPs por conta, da aba MCP das configurações.
  readonly accountMcp = new AccountMcp()
  // Conversas fechadas esperando encerrar.
  private releasing = new Map<AnySession, NodeJS.Timeout>()
  // Próxima conferência da memória (ver MEMORY_CHECK_MS); só existe com sessão esperando.
  private memoryTimer: NodeJS.Timeout | null = null
  // Chaves abertas em alguma janela agora (ver ChatHolders). A sessão vale enquanto qualquer chave
  // dela estiver aberta: conversa nova tem duas, e cada janela pode estar usando uma.
  private held = new Set<string>()
  // Avisos das sessões (ver SessionEvents): o mesmo objeto para todas.
  private events: Events = {
    changed: (s) => {
      s.keys.forEach((k) => this.onState(k, s.state))
      this.closeIfDone(s)
    },
    identified: (s, id) => {
      s.keys.add(id)
      this.sessions.set(id, s)
    },
    ended: (s) => {
      s.keys.forEach((k) => this.sessions.get(k) === s && this.sessions.delete(k))
      clearTimeout(this.releasing.get(s))
      this.releasing.delete(s)
    }
  }

  constructor(private onState: (key: string, state: ChatState) => void) {}

  // Conversa aberta de novo: cancela o encerramento que estava agendado.
  retain(key: string): void {
    this.held.add(key)
    const session = this.sessions.get(key)
    if (!session) return
    clearTimeout(this.releasing.get(session))
    this.releasing.delete(session)
    session.closeWhenIdle = false
    session.keepForRemote = false
  }

  // Conversa fechada: encerra a sessão, se nenhuma outra chave dela continua aberta. Se o Claude
  // ainda está trabalhando, espera ele terminar em vez de derrubar no meio.
  release(key: string): void {
    this.held.delete(key)
    const session = this.sessions.get(key)
    if (!session || this.releasing.has(session) || this.isHeld(session)) return
    this.releasing.set(
      session,
      setTimeout(() => {
        this.releasing.delete(session)
        if (!this.isHeld(session)) this.letGo(session)
      }, RELEASE_DELAY_MS)
    )
    // O Map guarda a ordem de entrada: a primeira é a fechada há mais tempo.
    if (this.releasing.size > MAX_RELEASING) this.endEarly(this.releasing.keys().next().value!)
    this.watchMemory(MEMORY_CHECK_MS)
  }

  // Encerra antes do prazo uma sessão fechada na tela (trabalhando, espera ela terminar: letGo).
  private endEarly(session: AnySession): void {
    clearTimeout(this.releasing.get(session))
    this.releasing.delete(session)
    this.letGo(session)
  }

  private watchMemory(delay: number): void {
    if (this.memoryTimer || this.releasing.size === 0) return
    this.memoryTimer = setTimeout(() => void this.checkMemory(), delay)
  }

  // Computador apertado de memória: encerra a sessão parada fechada há mais tempo e confere de novo
  // em seguida. Sem conseguir ler a memória, fica só com o prazo e o limite de quantidade.
  private async checkMemory(): Promise<void> {
    this.memoryTimer = null
    if (this.releasing.size === 0) return
    const tight = await memoryTight().catch(() => null)
    const oldest = tight ? [...this.releasing.keys()].find((s) => !s.busy && !s.remoteOn) : undefined
    if (oldest) this.endEarly(oldest)
    this.watchMemory(oldest ? MEMORY_SETTLE_MS : MEMORY_CHECK_MS)
  }

  // Nenhuma janela aberta: nada precisa das sessões de chat. Com a conta, só as dela (o login dela
  // mudou e as conversas paradas precisam abrir de novo com o novo).
  releaseAll(account?: string): void {
    new Set(this.sessions.values()).forEach((s) => (!account || s.account === account) && this.letGo(s))
  }

  // Workspace ganhou ou perdeu pasta: as sessões abertas na pasta dele encerram, e a próxima
  // mensagem reabre cada uma com a lista nova (o histórico continua). Parada encerra já; trabalhando,
  // quando terminar. Com o remote control ligado, fica como está: encerrar derrubaria o celular.
  restartIn(cwd: string): void {
    new Set(this.sessions.values()).forEach((s) => {
      if (!samePath(s.cwd, cwd) || s.remoteOn) return
      if (s.busy) s.closeWhenIdle = true
      else this.closeSession(s)
    })
  }

  // Conta removida: as conversas dela fecham na hora, mesmo trabalhando.
  closeAccount(account: string): void {
    new Set(this.sessions.values()).forEach((s) => s.account === account && this.closeSession(s))
  }

  private isHeld(session: AnySession): boolean {
    return [...session.keys].some((k) => this.held.has(k))
  }

  // Ninguém mais precisa da sessão: fecha já se está parada; senão, quando o Claude parar.
  private letGo(session: AnySession): void {
    // Remote control ligado: a conversa segue pelo celular mesmo fechada aqui, até ele cair.
    if (session.remoteOn) session.keepForRemote = true
    else if (!session.busy) this.closeSession(session)
    else session.closeWhenIdle = true
  }

  // Fechada na tela e o Claude parou: encerra agora, sem deixar processo aberto.
  private closeIfDone(session: AnySession): void {
    if (session.readyToClose) this.closeSession(session)
  }

  private closeSession(session: AnySession): void {
    clearTimeout(this.releasing.get(session))
    this.releasing.delete(session)
    session.keys.forEach((k) => this.sessions.get(k) === session && this.sessions.delete(k))
    session.close()
  }

  state(key: string): ChatState | null {
    return this.sessions.get(key)?.state ?? null
  }

  // Uma entrada por sessão aberta (a mesma sessão aparece em várias chaves).
  list(): ChatEntry[] {
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

  private find(req: { key: string; sessionId?: string }): AnySession | undefined {
    return this.sessions.get(req.key) ?? (req.sessionId ? this.sessions.get(req.sessionId) : undefined)
  }

  // Sessão da conversa, aberta agora se ainda não existe.
  private open(req: OpenRequest): AnySession {
    let session = this.find(req)
    // Trocou a conta do Claude na conversa já começada: a sessão parada fecha e abre de novo com a
    // nova, retomando a mesma conversa. Trabalhando ou com o remote control, segue na de antes.
    if (session instanceof ChatSession && !parseAgentRef(req.account) && session.account !== resolveAccount(req.account)) {
      if (!session.busy && !session.remoteOn) {
        this.closeSession(session)
        session = undefined
      }
    }
    if (!session) {
      const agent = agentFor(req)
      // Conversa do Claude num grupo com outro agente: a conta do grupo não serve, vale a padrão.
      session = agent
        ? new AgentChatSession(req.key, req, agent, this.events)
        : new ChatSession(req.key, parseAgentRef(req.account) ? { ...req, account: undefined } : req, this.events)
      this.sessions.set(req.key, session)
    }
    return session
  }

  answer(key: string, id: string, answer: PermissionAnswer): void {
    this.sessions.get(key)?.answer(id, answer)
  }

  // Conversa aberta responde pela própria sessão, na hora (com quem ainda está conectando); sem ela,
  // uma consulta avulsa com a conta do grupo, que espera todos terminarem.
  async mcpStatus(key: string, cwd: string, account?: string): Promise<McpStatus> {
    try {
      const session = this.sessions.get(key)
      if (session) return { ok: true, servers: await session.mcpServers(false), live: true }
      return { ok: true, servers: parseAgentRef(account) ? [] : await mcpStatusFor(cwd, account), live: false }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  }

  // "Reconectar" de um servidor no painel; só com a sessão da conversa aberta.
  async reconnectMcp(key: string, name: string): Promise<McpStatus> {
    const session = this.sessions.get(key)
    if (!session) return { ok: false, error: tr('A conversa não está aberta.', 'The chat isn’t open.') }
    try {
      await session.reconnectMcp(name)
      return { ok: true, servers: await session.mcpServers(false), live: true }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  }

  // "Autorizar" e "Desconectar" de um servidor no painel; só com a sessão da conversa aberta (o
  // `claude` dela espera a volta do navegador).
  async authenticateMcp(key: string, name: string): Promise<McpAuthResult> {
    const session = this.sessions.get(key)
    if (!session) return { ok: false, error: tr('A conversa não está aberta.', 'The chat isn’t open.') }
    return session.authenticateMcp(name)
  }

  async clearMcpAuth(key: string, name: string): Promise<McpStatus> {
    const session = this.sessions.get(key)
    if (!session) return { ok: false, error: tr('A conversa não está aberta.', 'The chat isn’t open.') }
    try {
      await session.clearMcpAuth(name)
      return { ok: true, servers: await session.mcpServers(false), live: true }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  }

  // "Remover" do painel: sai da configuração na hora; a sessão aberta ainda o vê até reabrir, então
  // a lista devolvida já vem sem ele.
  async removeMcp(key: string, cwd: string, account: string | undefined, name: string, scope: string): Promise<McpStatus> {
    try {
      await removeMcp(name, scope, parseAgentRef(account) ? undefined : account, cwd)
      const status = await this.mcpStatus(key, cwd, account)
      return status.ok ? { ...status, servers: status.servers.filter((s) => s.name !== name) } : status
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  }

  // /output-style. Conversa do Claude aberta responde e grava pela própria sessão; sem ela, pelo
  // arquivo da pasta. Outro agente (Codex, Gemini, Cursor) não tem estilo de resposta.
  async outputStyle(key: string, cwd: string, account?: string): Promise<OutputStyleStatus> {
    if (parseAgentRef(account)) return { ok: false, error: tr('Só as conversas do Claude têm estilo de resposta.', 'Only Claude chats have an output style.') }
    try {
      const session = this.sessions.get(key)
      return { ok: true, style: session instanceof ChatSession ? await session.outputStyle() : readOutputStyle(cwd) }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  }

  async setOutputStyle(key: string, cwd: string, style: string): Promise<OutputStyleStatus> {
    try {
      const session = this.sessions.get(key)
      if (session instanceof ChatSession) await session.setOutputStyle(style)
      else writeOutputStyle(cwd, style)
      return { ok: true, style }
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
    this.accountMcp.closeAll()
    if (this.memoryTimer) clearTimeout(this.memoryTimer)
    this.memoryTimer = null
    this.releasing.forEach((timer) => clearTimeout(timer))
    this.releasing.clear()
    new Set(this.sessions.values()).forEach((s) => s.close())
    this.sessions.clear()
  }
}
