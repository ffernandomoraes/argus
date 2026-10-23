import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatSendRequest, ChatState } from '../../shared/chat'
import { Chats } from './index'

// O registro das conversas abertas: quando cada sessão do Claude fecha. Aqui a sessão é falsa (a
// de verdade tem testes próprios em session.test.ts); o que importa é o registro não derrubar uma
// conversa trabalhando nem deixar processo parado ocupando memória.

const fake = vi.hoisted(() => {
  type Events = { changed: (s: FakeSession) => void; identified: (s: FakeSession, id: string) => void; ended: (s: FakeSession) => void }
  class FakeSession {
    readonly keys = new Set<string>()
    readonly cwd: string
    readonly account: string
    closeWhenIdle = false
    keepForRemote = false
    busy = false
    remoteOn = false
    closed = false
    sent: string[] = []
    state = { status: 'idle', agents: [] } as unknown as ChatState
    constructor(
      key: string,
      req: { cwd: string; account?: string },
      readonly events: Events
    ) {
      this.keys.add(key)
      this.cwd = req.cwd
      this.account = req.account || 'main'
      sessions.push(this)
    }
    get readyToClose() {
      return !this.busy && (this.closeWhenIdle || (this.keepForRemote && !this.remoteOn))
    }
    send(req: { text: string }) {
      this.sent.push(req.text)
    }
    close() {
      this.closed = true
    }
    // O Claude parou: a sessão avisa o registro, como a de verdade faz a cada estado novo.
    stop() {
      this.busy = false
      this.events.changed(this)
    }
  }
  const sessions: FakeSession[] = []
  return { FakeSession, sessions, memoryTight: vi.fn(async (): Promise<boolean | null> => false) }
})

vi.mock('./session', () => ({ ChatSession: fake.FakeSession }))
vi.mock('../agentChats/session', () => ({ AgentChatSession: class {} }))
vi.mock('../agentChats/store', () => ({ isAgentConversation: () => false, indexEntry: () => undefined, samePath: (a: string, b: string) => a === b }))
vi.mock('./systemMemory', () => ({ memoryTight: fake.memoryTight }))
vi.mock('./accountMcp', () => ({ AccountMcp: class { closeAll() {} } }))
vi.mock('./mcpStatus', () => ({ mcpStatusFor: vi.fn(), removeMcp: vi.fn() }))
vi.mock('./outputStyle', () => ({ readOutputStyle: vi.fn(), writeOutputStyle: vi.fn() }))
vi.mock('./env', () => ({ claudeEnv: vi.fn(), claudeLaunch: vi.fn(), claudeProcess: vi.fn() }))
vi.mock('../accounts', () => ({ resolveAccount: (id?: string) => id || 'main' }))

const MINUTE = 60_000
const settings = { model: '', effort: '', thinking: false, ultracode: false, permissionMode: 'manual' }
const send = (key: string, patch: Partial<ChatSendRequest> = {}): ChatSendRequest => ({ key, cwd: '/p', settings, text: 'oi', images: [], ...patch })

function setup() {
  const chats = new Chats(() => undefined)
  // Abre uma conversa na tela e manda a primeira mensagem.
  const openChat = (key: string, patch: Partial<ChatSendRequest> = {}) => {
    chats.retain(key)
    chats.send(send(key, patch))
    return fake.sessions.at(-1)!
  }
  return { chats, openChat }
}

beforeEach(() => {
  vi.useFakeTimers()
  fake.sessions.length = 0
  fake.memoryTight.mockResolvedValue(false)
})
afterEach(() => vi.useRealTimers())

describe('Chats: conversa fechada na tela', () => {
  // b488a70: fechada, a sessão continua aberta 10 minutos; voltar nela não reabre o Claude.
  it('continua aberta 10 minutos e encerra depois', () => {
    const { chats, openChat } = setup()
    const s = openChat('a')
    chats.release('a')
    vi.advanceTimersByTime(10 * MINUTE - 1)
    expect(s.closed).toBe(false)
    vi.advanceTimersByTime(1)
    expect(s.closed).toBe(true)
    expect(chats.has('a')).toBe(false)
  })

  it('aberta de novo dentro do prazo, segue com a mesma sessão', () => {
    const { chats, openChat } = setup()
    const s = openChat('a')
    chats.release('a')
    vi.advanceTimersByTime(5 * MINUTE)
    chats.retain('a')
    vi.advanceTimersByTime(20 * MINUTE)
    expect(s.closed).toBe(false)
    chats.send(send('a'))
    expect(fake.sessions).toHaveLength(1)
    expect(s.sent).toEqual(['oi', 'oi'])
  })

  it('trabalhando no fim do prazo, espera o Claude parar em vez de derrubar no meio', () => {
    const { chats, openChat } = setup()
    const s = openChat('a')
    s.busy = true
    chats.release('a')
    vi.advanceTimersByTime(10 * MINUTE)
    expect(s.closed).toBe(false)
    s.stop()
    expect(s.closed).toBe(true)
  })

  it('no máximo 3 esperando: a fechada há mais tempo encerra antes do prazo', () => {
    const { chats, openChat } = setup()
    const sessions = ['a', 'b', 'c', 'd'].map((k) => openChat(k))
    ;['a', 'b', 'c', 'd'].forEach((k) => chats.release(k))
    expect(sessions.map((s) => s.closed)).toEqual([true, false, false, false])
  })

  // Conversa nova tem duas chaves (a do app e o id da sessão), e cada janela pode estar com uma.
  it('aberta em outra janela pela outra chave, fechar numa não encerra', () => {
    const { chats, openChat } = setup()
    const s = openChat('a')
    s.events.identified(s, 'sess-1')
    chats.retain('sess-1')
    chats.release('a')
    vi.advanceTimersByTime(30 * MINUTE)
    expect(s.closed).toBe(false)
    chats.release('sess-1')
    vi.advanceTimersByTime(10 * MINUTE)
    expect(s.closed).toBe(true)
  })

  it('a aberta em outra janela não conta no limite de 3 nem é encerrada por ele', () => {
    const { chats, openChat } = setup()
    const shown = openChat('a')
    shown.events.identified(shown, 'sess-1')
    chats.retain('sess-1')
    chats.release('a')
    const others = ['b', 'c', 'd'].map((k) => openChat(k))
    ;['b', 'c', 'd'].forEach((k) => chats.release(k))
    expect([shown, ...others].map((s) => s.closed)).toEqual([false, false, false, false])
  })

  it('com o remote control ligado, segue pelo celular depois do prazo', () => {
    const { chats, openChat } = setup()
    const s = openChat('a')
    s.remoteOn = true
    chats.release('a')
    vi.advanceTimersByTime(10 * MINUTE)
    expect(s.closed).toBe(false)
    expect(s.keepForRemote).toBe(true)
  })
})

describe('Chats: memória do computador', () => {
  it('apertado, encerra a parada fechada há mais tempo antes do prazo, uma por vez', async () => {
    const { chats, openChat } = setup()
    const [a, b] = [openChat('a'), openChat('b')]
    chats.release('a')
    chats.release('b')
    fake.memoryTight.mockResolvedValue(true)
    await vi.advanceTimersByTimeAsync(MINUTE)
    expect([a.closed, b.closed]).toEqual([true, false])
    await vi.advanceTimersByTimeAsync(10_000)
    expect(b.closed).toBe(true)
  })

  it('com folga, ou sem saber, nada encerra antes do prazo', async () => {
    const { chats, openChat } = setup()
    const a = openChat('a')
    chats.release('a')
    fake.memoryTight.mockResolvedValue(null)
    await vi.advanceTimersByTimeAsync(5 * MINUTE)
    expect(a.closed).toBe(false)
  })

  it('apertado, pula a que está trabalhando e encerra a parada seguinte', async () => {
    const { chats, openChat } = setup()
    const [working, idle] = [openChat('a'), openChat('b')]
    working.busy = true
    chats.release('a')
    chats.release('b')
    fake.memoryTight.mockResolvedValue(true)
    await vi.advanceTimersByTimeAsync(MINUTE)
    expect([working.closed, working.closeWhenIdle, idle.closed]).toEqual([false, false, true])
  })
})

describe('Chats: chaves e contas', () => {
  it('conversa nova ganha o id da sessão como chave, e qualquer uma acha a mesma sessão', () => {
    const { chats, openChat } = setup()
    const s = openChat('novo')
    s.events.identified(s, 'sess-1')
    expect(chats.has('sess-1')).toBe(true)
    expect(chats.list()).toHaveLength(1)
    chats.send(send('outra-chave', { sessionId: 'sess-1' }))
    expect(fake.sessions).toHaveLength(1)
  })

  it('trocou a conta da conversa parada: reabre com a nova; trabalhando, segue na de antes', () => {
    const { chats, openChat } = setup()
    const a = openChat('a')
    chats.send(send('a', { account: 'trabalho' }))
    expect(a.closed).toBe(true)
    const b = fake.sessions.at(-1)!
    expect(b.account).toBe('trabalho')
    b.busy = true
    chats.send(send('a'))
    expect(b.closed).toBe(false)
    expect(fake.sessions).toHaveLength(2)
  })

  it('pasta do workspace mudou: a parada encerra já, a que trabalha encerra ao parar', () => {
    const { chats, openChat } = setup()
    const idle = openChat('a')
    const working = openChat('b')
    const other = openChat('c', { cwd: '/outra' })
    working.busy = true
    chats.restartIn('/p')
    expect([idle.closed, working.closed, other.closed]).toEqual([true, false, false])
    expect(working.closeWhenIdle).toBe(true)
  })

  it('conta removida fecha as conversas dela na hora, mesmo trabalhando', () => {
    const { chats, openChat } = setup()
    const a = openChat('a', { account: 'x' })
    const b = openChat('b')
    a.busy = true
    chats.closeAccount('x')
    expect([a.closed, b.closed]).toEqual([true, false])
  })

  it('o Claude encerrou sozinho: a conversa sai do registro', () => {
    const { chats, openChat } = setup()
    const s = openChat('a')
    s.events.ended(s)
    expect(chats.has('a')).toBe(false)
  })
})
