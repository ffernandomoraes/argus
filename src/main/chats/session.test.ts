import type { CanUseTool, SDKMessage, SDKUserMessage } from '@anthropic-ai/claude-agent-sdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatSendRequest } from '../../shared/chat'
import { ChatSession, type SessionEvents } from './session'

// A conversa inteira contra um Claude Code falso: o teste manda as mensagens que o SDK mandaria e
// confere o que a tela recebe. Nada abre processo.

type Options = { canUseTool: CanUseTool; resume?: string; model?: string }

const fake = vi.hoisted(() => {
  // A Query do SDK: as mensagens saem na ordem em que o teste as manda.
  class FakeQuery {
    private pending: SDKMessage[] = []
    private wake: (() => void) | null = null
    private done = false
    private failure: Error | null = null
    prompt: AsyncIterable<SDKUserMessage>
    options: Options
    interrupt = vi.fn(async (): Promise<{ still_queued: string[] } | undefined> => undefined)
    close = vi.fn(() => this.end())
    setModel = vi.fn(async () => undefined)
    setPermissionMode = vi.fn(async () => undefined)
    applyFlagSettings = vi.fn(async () => undefined)

    constructor(args: { prompt: AsyncIterable<SDKUserMessage>; options: Options }) {
      this.prompt = args.prompt
      this.options = args.options
    }

    emit(m: Record<string, unknown>): void {
      this.pending.push(m as unknown as SDKMessage)
      this.wake?.()
    }

    end(): void {
      this.done = true
      this.wake?.()
    }

    fail(err: Error): void {
      this.failure = err
      this.wake?.()
    }

    async *[Symbol.asyncIterator](): AsyncIterator<SDKMessage> {
      while (true) {
        if (this.pending.length) yield this.pending.shift()!
        else if (this.failure) throw this.failure
        else if (this.done) return
        else await new Promise<void>((r) => (this.wake = r))
      }
    }
  }
  return { FakeQuery, queries: [] as InstanceType<typeof FakeQuery>[] }
})

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: (args: ConstructorParameters<typeof fake.FakeQuery>[0]) => {
    const q = new fake.FakeQuery(args)
    fake.queries.push(q)
    return q
  }
}))
vi.mock('./env', () => ({ claudeCodeOptions: (cwd: string) => ({ cwd, env: {} }) }))
vi.mock('../accounts', () => ({ resolveAccount: (id?: string) => id || 'main' }))
vi.mock('../contextWindows', () => ({ learnContextWindow: vi.fn() }))
vi.mock('../orchestration', () => ({
  orchestrationEnabled: () => false,
  ORCHESTRATION_TOOLS: [],
  sdkOrchestrationTools: () => [],
  DelegateCalls: class {}
}))
vi.mock('../terminals/drawerShells', () => ({ ARGUS_MCP: 'argus', ARGUS_ALLOWED_TOOLS: [], argusMcp: () => ({}) }))
vi.mock('./mcpStatus', () => ({ mcpServersOf: vi.fn(), authenticateMcp: vi.fn(), clearMcpAuth: vi.fn() }))

const settings = { model: '', effort: '', thinking: false, ultracode: false, permissionMode: 'manual' }
const request = (text = 'oi'): ChatSendRequest => ({ key: 'k1', cwd: '/Users/ana/proj', settings, text, images: [] })

const event = (e: Record<string, unknown>) => ({ type: 'stream_event', event: e, parent_tool_use_id: null })
const startReply = () => event({ type: 'message_start' })
const textChunk = (text: string) => event({ type: 'content_block_delta', delta: { type: 'text_delta', text } })
const result = (extra: Record<string, unknown> = {}) => ({ type: 'result', subtype: 'success', is_error: false, result: 'ok', ...extra })
const tasks = (ids: string[]) => ({ type: 'system', subtype: 'background_tasks_changed', tasks: ids.map((task_id) => ({ task_id })) })

// Deixa o laço da sessão ler o que já foi mandado.
const settle = () => vi.advanceTimersByTimeAsync(0)

function open() {
  const events = { changed: vi.fn(), identified: vi.fn(), ended: vi.fn() } satisfies SessionEvents
  const session = new ChatSession('k1', request(), events)
  const q = fake.queries.at(-1)!
  return { session, q, events }
}

beforeEach(() => {
  vi.useFakeTimers()
  fake.queries.length = 0
})
afterEach(() => vi.useRealTimers())

describe('ChatSession: mandar e receber', () => {
  it('a mensagem vai para o Claude e a conversa passa a trabalhar', async () => {
    const { session, q } = open()
    session.send(request('arruma o login'))
    const first = await q.prompt[Symbol.asyncIterator]().next()
    expect((first.value as SDKUserMessage).message.content).toEqual([{ type: 'text', text: 'arruma o login' }])
    expect(session.state.status).toBe('running')
    expect(session.state.turnStartedAt).toBeTypeOf('number')
    expect(session.busy).toBe(true)
  })

  it('o id da sessão informado pelo Claude vira mais uma chave da conversa', async () => {
    const { q, events } = open()
    q.emit({ type: 'system', subtype: 'init', session_id: 'sess-1' })
    await settle()
    expect(events.identified).toHaveBeenCalledWith(expect.anything(), 'sess-1')
  })

  it('a resposta chega aos pedaços, e o fim do pedido deixa a conversa parada', async () => {
    const { session, q } = open()
    session.send(request())
    q.emit(startReply())
    q.emit(textChunk('Olá, '))
    q.emit(textChunk('pronto.'))
    await settle()
    expect(session.state.partial).toBe('Olá, pronto.')
    q.emit(result())
    await settle()
    expect(session.state).toMatchObject({ status: 'idle', turnStartedAt: undefined, error: undefined })
  })

  // bffca93: a gravação da resposta podia atrasar e as releituras do fim do pedido não a pegavam; a
  // resposta sumia da tela até reabrir a conversa (principalmente no WSL).
  it('a prévia fica um tempo depois do fim e sai junto com mais uma releitura do histórico', async () => {
    const { session, q } = open()
    session.send(request())
    q.emit(startReply())
    q.emit(textChunk('resposta inteira'))
    q.emit(result())
    await settle()
    const revision = session.state.revision
    expect(session.state.partial).toBe('resposta inteira')
    await vi.advanceTimersByTimeAsync(3000)
    expect(session.state.partial).toBe('')
    expect(session.state.revision).toBe(revision + 1)
  })

  it('resposta nova começando nesse meio-tempo mantém a prévia dela', async () => {
    const { session, q } = open()
    session.send(request())
    q.emit(startReply())
    q.emit(textChunk('primeira'))
    q.emit(result())
    await settle()
    session.send(request('outra'))
    q.emit(startReply())
    q.emit(textChunk('segunda'))
    await settle()
    await vi.advanceTimersByTimeAsync(3000)
    expect(session.state.partial).toBe('segunda')
  })

  it('erro do Claude aparece na conversa', async () => {
    const { session, q } = open()
    session.send(request())
    q.emit(result({ subtype: 'error_during_execution', is_error: true, result: 'Falhou a API' }))
    await settle()
    expect(session.state.error).toBe('Falhou a API')
  })

  it('mensagem num formato inesperado não derruba a conversa', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { session, q } = open()
    session.send(request())
    q.emit({ type: 'stream_event', parent_tool_use_id: null })
    q.emit(startReply())
    q.emit(textChunk('segue'))
    await settle()
    expect(session.state.partial).toBe('segue')
    expect(quiet).toHaveBeenCalled()
    quiet.mockRestore()
  })
})

describe('ChatSession: fim do processo', () => {
  it('o Claude encerrou: tudo volta para parado e o registro fica sabendo', async () => {
    const { session, q, events } = open()
    session.send(request())
    q.emit(startReply())
    q.emit(textChunk('pela metade'))
    q.emit(tasks(['t1']))
    await settle()
    q.end()
    await settle()
    expect(session.state).toMatchObject({ status: 'idle', partial: '', permissions: [], agents: [], backgroundTasks: 0 })
    expect(events.ended).toHaveBeenCalledTimes(1)
    expect(session.busy).toBe(false)
  })

  it('sem o Claude Code instalado, o erro explica o que fazer', async () => {
    const { session, q } = open()
    q.fail(new Error('Claude Code native binary not found'))
    await settle()
    expect(session.state.error).toContain('não está instalado')
  })
})

describe('ChatSession: mensagem no meio da resposta', () => {
  it('fica na fila à vista e segura a sessão até o Claude começar o pedido com ela', async () => {
    const { session, q } = open()
    session.send(request('primeira'))
    q.emit(startReply())
    await settle()
    session.send(request('mandada no meio'))
    expect(session.state.queued?.map((m) => m.text)).toEqual(['mandada no meio'])
    q.emit(result())
    await settle()
    // Parado, mas com mensagem esperando: fechar agora mataria a mensagem.
    expect(session.state.status).toBe('idle')
    expect(session.busy).toBe(true)
    q.emit(startReply())
    await settle()
    expect(session.state.queued).toEqual([])
  })
})

describe('ChatSession: parar', () => {
  it('sem nada na fila, a tela para na hora e o fim do pedido parado não vira erro', async () => {
    const { session, q } = open()
    session.send(request())
    q.emit(startReply())
    q.emit(textChunk('meio'))
    await settle()
    await session.interrupt()
    expect(session.state).toMatchObject({ status: 'idle', partial: '' })
    q.emit(result({ subtype: 'error_during_execution', is_error: true }))
    await settle()
    expect(session.state.error).toBeUndefined()
  })

  it('mensagem que o Claude diz que continua na fila roda logo depois da parada', async () => {
    const { session, q } = open()
    session.send(request())
    q.emit(startReply())
    await settle()
    session.send(request('próxima'))
    const queuedId = session.state.queued![0].id
    q.interrupt.mockResolvedValueOnce({ still_queued: [queuedId] })
    await session.interrupt()
    q.emit(result({ subtype: 'error_during_execution', is_error: true }))
    await settle()
    expect(session.state.status).toBe('running')
    expect(session.state.error).toBeUndefined()
  })
})

describe('ChatSession: permissões', () => {
  it('pedido de permissão deixa a conversa esperando você, e a resposta libera', async () => {
    const { session, q } = open()
    session.send(request())
    const decision = q.options.canUseTool('Bash', { command: 'ls' }, {
      toolUseID: 't1',
      signal: new AbortController().signal
    } as Parameters<CanUseTool>[2])
    expect(session.state.status).toBe('needs-you')
    expect(session.state.permissions.map((p) => p.id)).toEqual(['t1'])
    session.answer('t1', 'allow')
    expect(await decision).toMatchObject({ behavior: 'allow' })
    expect(session.state).toMatchObject({ status: 'running', permissions: [] })
  })

  it('conversa fechada nega o que esperava resposta', async () => {
    const { session, q } = open()
    const decision = q.options.canUseTool('Bash', { command: 'ls' }, {
      toolUseID: 't1',
      signal: new AbortController().signal
    } as Parameters<CanUseTool>[2])
    session.close()
    expect(await decision).toMatchObject({ behavior: 'deny' })
    expect(q.close).toHaveBeenCalled()
  })
})

describe('ChatSession: quando pode fechar', () => {
  it('fechada na tela, só fica livre depois de parar', async () => {
    const { session, q } = open()
    session.closeWhenIdle = true
    session.send(request())
    expect(session.readyToClose).toBe(false)
    q.emit(startReply())
    q.emit(result())
    q.emit({ type: 'system', subtype: 'session_state_changed', state: 'idle' })
    await settle()
    expect(session.readyToClose).toBe(true)
  })

  it('o Claude Code dizendo que ainda roda segura a sessão, mesmo depois do fim do pedido', async () => {
    const { session, q } = open()
    session.closeWhenIdle = true
    q.emit({ type: 'system', subtype: 'session_state_changed', state: 'running' })
    await settle()
    expect(session.readyToClose).toBe(false)
  })

  // Fechar logo depois de uma tarefa em segundo plano terminar matava o pedido que entrega o aviso
  // dela: a resposta só vinha na sua próxima mensagem.
  it('tarefa em segundo plano que terminou segura a sessão até o pedido do aviso começar', async () => {
    const { session, q } = open()
    session.closeWhenIdle = true
    q.emit(tasks(['t1']))
    await settle()
    expect(session.readyToClose).toBe(false)
    q.emit(tasks([]))
    await settle()
    expect(session.state.backgroundTasks).toBe(0)
    expect(session.readyToClose).toBe(false)
    q.emit({ type: 'system', subtype: 'session_state_changed', state: 'running' })
    q.emit({ type: 'system', subtype: 'session_state_changed', state: 'idle' })
    await settle()
    expect(session.readyToClose).toBe(true)
  })

  it('se o pedido do aviso não vier, libera depois de um minuto', async () => {
    const { session, q } = open()
    session.closeWhenIdle = true
    q.emit(tasks(['t1']))
    q.emit(tasks([]))
    await settle()
    await vi.advanceTimersByTimeAsync(59_000)
    expect(session.readyToClose).toBe(false)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(session.readyToClose).toBe(true)
  })

  it('com o remote control ligado, a conversa fechada na tela continua de pé até ele cair', async () => {
    const { session, q } = open()
    session.keepForRemote = true
    session.state = { ...session.state, remote: { status: 'connected' } }
    expect(session.readyToClose).toBe(false)
    q.emit({ type: 'system', subtype: 'bridge_state', state: 'failed', detail: 'caiu' })
    await settle()
    expect(session.readyToClose).toBe(true)
  })
})

describe('ChatSession: configurações com a conversa aberta', () => {
  it('troca de esforço vai com o ultracode atual, e a troca falhando aparece como erro', async () => {
    const { session, q } = open()
    await session.configure({ effort: 'high' })
    expect(q.applyFlagSettings).toHaveBeenCalledWith({ effortLevel: 'high', ultracode: false })
    q.setModel.mockRejectedValueOnce(new Error('modelo indisponível'))
    await session.configure({ model: 'claude-fable-5-1' })
    expect(session.state.error).toContain('modelo indisponível')
  })

  it('"manual" vira o modo padrão do Claude Code', async () => {
    const { session, q } = open()
    await session.configure({ permissionMode: 'manual' })
    expect(q.setPermissionMode).toHaveBeenCalledWith('default')
  })
})
