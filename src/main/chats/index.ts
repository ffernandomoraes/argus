import type { ChatRemoteRequest, ChatSendRequest, ChatSettings, ChatState, PermissionAnswer } from '../../shared/chat'
import type { McpStatus } from '../../shared/mcp'
import type { ChatEntry } from './entries'
import { mcpStatusFor } from './mcpStatus'
import { ChatSession, type OpenRequest, type SessionEvents } from './session'

export { claudeEnv, claudeProcess } from './env'
export { Inbox } from './inbox'
export type { ChatEntry } from './entries'

// Conversa fechada espera um pouco antes de encerrar: trocar de conversa ou a tela
// se redesenhar não pode derrubar uma sessão que volta em seguida.
const RELEASE_DELAY_MS = 5_000

// Uma sessão do Claude por conversa aberta no chat. A chave é o id da conversa no app;
// conversa nova ganha também o id da sessão como chave, assim que o Claude informa.
export class Chats {
  private sessions = new Map<string, ChatSession>()
  // Conversas fechadas esperando encerrar.
  private releasing = new Map<ChatSession, NodeJS.Timeout>()
  // Chaves abertas em alguma janela agora (ver ChatHolders). A sessão vale enquanto qualquer chave
  // dela estiver aberta: conversa nova tem duas, e cada janela pode estar usando uma.
  private held = new Set<string>()
  // Avisos das sessões (ver SessionEvents): o mesmo objeto para todas.
  private events: SessionEvents = {
    changed: (s) => {
      s.keys.forEach((k) => this.onState(k, s.state))
      this.closeIfDone(s)
    },
    identified: (s, id) => {
      s.keys.add(id)
      this.sessions.set(id, s)
    },
    ended: (s) => s.keys.forEach((k) => this.sessions.get(k) === s && this.sessions.delete(k))
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
  }

  // Nenhuma janela aberta: nada precisa das sessões de chat. Com a conta, só as dela (o login dela
  // mudou e as conversas paradas precisam abrir de novo com o novo).
  releaseAll(account?: string): void {
    new Set(this.sessions.values()).forEach((s) => (!account || s.account === account) && this.letGo(s))
  }

  // Conta removida: as conversas dela fecham na hora, mesmo trabalhando.
  closeAccount(account: string): void {
    new Set(this.sessions.values()).forEach((s) => s.account === account && this.closeSession(s))
  }

  private isHeld(session: ChatSession): boolean {
    return [...session.keys].some((k) => this.held.has(k))
  }

  // Ninguém mais precisa da sessão: fecha já se está parada; senão, quando o Claude parar.
  private letGo(session: ChatSession): void {
    // Remote control ligado: a conversa segue pelo celular mesmo fechada aqui, até ele cair.
    if (session.remoteOn) session.keepForRemote = true
    else if (!session.busy) this.closeSession(session)
    else session.closeWhenIdle = true
  }

  // Fechada na tela e o Claude parou: encerra agora, sem deixar processo aberto.
  private closeIfDone(session: ChatSession): void {
    if (session.readyToClose) this.closeSession(session)
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

  private find(req: { key: string; sessionId?: string }): ChatSession | undefined {
    return this.sessions.get(req.key) ?? (req.sessionId ? this.sessions.get(req.sessionId) : undefined)
  }

  // Sessão da conversa, aberta agora se ainda não existe.
  private open(req: OpenRequest): ChatSession {
    let session = this.find(req)
    if (!session) {
      session = new ChatSession(req.key, req, this.events)
      this.sessions.set(req.key, session)
    }
    return session
  }

  answer(key: string, id: string, answer: PermissionAnswer): void {
    this.sessions.get(key)?.answer(id, answer)
  }

  // Conversa aberta responde pela própria sessão; sem ela, uma consulta avulsa com a conta do grupo.
  async mcpStatus(key: string, cwd: string, account?: string): Promise<McpStatus> {
    try {
      const session = this.sessions.get(key)
      return { ok: true, servers: session ? await session.mcpServers() : await mcpStatusFor(cwd, account) }
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
