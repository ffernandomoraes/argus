import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ChatSendRequest, ChatSettings } from '../../shared/chat'
import type { AgentRef } from '../../shared/providers'
import type { DriverEvents, PermissionReply, PromptInput, ToolEvent } from './driver'
import { loadConversation, saveConversation } from './store'

// A conversa com Codex, Gemini ou Cursor de ponta a ponta, com o agente trocado por um falso que o
// teste controla: o que a pessoa vê (estado da tela) e o que fica gravado (store de verdade, na
// pasta pessoal falsa).

const fake = vi.hoisted(() => {
  class FakeDriver {
    events: DriverEvents
    started: (string | undefined)[] = []
    prompts: PromptInput[] = []
    cancels = 0
    finish: (err?: Error) => void = () => {}
    constructor(...args: unknown[]) {
      // Codex: (account, cwd, settings, events); ACP: (provider, account, cwd, settings, events).
      this.events = args.find((a) => typeof a === 'object' && a !== null && 'textDone' in a) as DriverEvents
      fake.provider = args.length >= 5 && typeof args[0] === 'string' && typeof args[4] === 'object' ? (args[0] as string) : 'codex'
      fake.drivers.push(this)
    }
    async start(nativeId?: string) {
      this.started.push(nativeId)
      return nativeId ?? 'native-1'
    }
    prompt(input: PromptInput) {
      this.prompts.push(input)
      return new Promise<void>((resolve, reject) => (this.finish = (err) => (err ? reject(err) : resolve())))
    }
    async cancel() {
      this.cancels++
      this.finish()
    }
    async configure() {}
    close() {}
  }
  return { FakeDriver, drivers: [] as InstanceType<typeof FakeDriver>[], provider: '' }
})

vi.mock('./codex', () => ({ CodexDriver: fake.FakeDriver }))
vi.mock('./acp', () => ({ AcpDriver: fake.FakeDriver }))
vi.mock('./models', () => ({ sanitizeSettings: async (_ref: unknown, s: unknown) => s }))
vi.mock('../orchestration', () => ({
  orchestrationEnabled: () => false,
  registerHost: async () => ({ url: '', dispose: () => {} }),
  DelegateCalls: class {
    seen() {}
    claim() {
      return undefined
    }
  }
}))

const { AgentChatSession } = await import('./session')

const settings: ChatSettings = { model: '', effort: '', thinking: false, ultracode: false, permissionMode: 'default' }
const CODEX: AgentRef = { provider: 'codex', account: 'main' }

function open(ref: AgentRef = CODEX, sessionId?: string) {
  const seen = { identified: [] as string[], changes: 0 }
  const session = new AgentChatSession('k', { key: 'k', cwd: '/Users/ana/proj', settings, ...(sessionId && { sessionId }) }, ref, {
    changed: () => seen.changes++,
    identified: (_s, id) => seen.identified.push(id),
    ended: () => {}
  })
  return { session, seen }
}

const send = (session: InstanceType<typeof AgentChatSession>, text: string, extra: Partial<ChatSendRequest> = {}) =>
  session.send({ key: 'k', cwd: '/Users/ana/proj', settings, text, images: [], ...extra })

const driver = () => fake.drivers.at(-1)!
const started = () => vi.waitFor(() => expect(driver()?.prompts.length).toBeGreaterThan(0))
const stored = (s: InstanceType<typeof AgentChatSession>) => loadConversation(s.id)!
const idle = (s: InstanceType<typeof AgentChatSession>) => vi.waitFor(() => expect(s.state.status).toBe('idle'))
const tool = (extra: Partial<ToolEvent> = {}): ToolEvent => ({ id: 't1', name: 'command', label: 'Comando', input: 'ls', done: false, ...extra })

afterEach(() => {
  fake.drivers = []
  vi.useRealTimers()
})

describe('mandar e receber', () => {
  it('a mensagem entra no histórico, a conversa ganha título e id, e a resposta fica gravada', async () => {
    const { session, seen } = open()
    send(session, 'Arrumar o login\ncom detalhes')
    expect(session.state.status).toBe('running')
    expect(seen.identified).toEqual([session.id])
    await started()
    driver().events.text('Pronto, ')
    driver().events.text('arrumei.')
    expect(session.state.partial).toBe('Pronto, arrumei.')
    driver().finish()
    await idle(session)
    const c = stored(session)
    expect(c.title).toBe('Arrumar o login')
    expect(c.nativeId).toBe('native-1')
    expect(c.messages.map((m) => [m.role, 'text' in m ? m.text : ''])).toEqual([
      ['user', 'Arrumar o login\ncom detalhes'],
      ['assistant', 'Pronto, arrumei.']
    ])
    expect(session.state.partial).toBe('')
  })

  // e5c0def: o caminho dos anexos aparecia no texto do balão.
  it('anexos e aviso oculto vão para o agente, mas não aparecem no balão', async () => {
    const { session } = open()
    send(session, 'olha', { files: [{ path: '/Users/ana/proj/doc.pdf', size: 10 }], hint: '<aviso>use o agente X</aviso>' })
    await started()
    const prompt = driver().prompts[0].text
    expect(prompt).toContain('/Users/ana/proj/doc.pdf')
    expect(prompt).toContain('use o agente X')
    driver().finish()
    await idle(session)
    expect(stored(session).messages[0]).toMatchObject({ role: 'user', text: 'olha', files: [{ path: '/Users/ana/proj/doc.pdf' }] })
  })

  it('erro do agente aparece na conversa e ela volta a ficar parada', async () => {
    const { session } = open()
    send(session, 'oi')
    await started()
    driver().finish(new Error('Limite de uso atingido'))
    await idle(session)
    expect(session.state.error).toBe('Limite de uso atingido')
  })

  it('agente que fecha no meio do pedido mostra o motivo', async () => {
    const { session } = open()
    send(session, 'oi')
    await started()
    driver().events.exited('o processo saiu (1)')
    expect(session.state.error).toBe('o processo saiu (1)')
  })
})

describe('mensagem enviada com o agente trabalhando', () => {
  it('espera na fila e roda logo depois, na ordem', async () => {
    const { session } = open()
    send(session, 'primeira')
    await started()
    send(session, 'segunda')
    expect(session.state.queued?.map((q) => q.text)).toEqual(['segunda'])
    // Só entra no histórico quando chega a vez dela.
    await vi.waitFor(() => expect(loadConversation(session.id)?.messages.map((m) => ('text' in m ? m.text : ''))).toEqual(['primeira']))
    driver().finish()
    await vi.waitFor(() => expect(driver().prompts).toHaveLength(2))
    expect(driver().prompts[1].text).toBe('segunda')
    expect(session.state.queued).toEqual([])
    driver().finish()
    await idle(session)
    expect(stored(session).messages.map((m) => ('text' in m ? m.text : ''))).toEqual(['primeira', 'segunda'])
  })

  it('parar o pedido mantém a fila: a mensagem seguinte roda depois', async () => {
    const { session } = open()
    send(session, 'primeira')
    await started()
    send(session, 'segunda')
    await session.interrupt()
    await vi.waitFor(() => expect(driver().prompts).toHaveLength(2))
    expect(driver().cancels).toBe(1)
    await vi.waitFor(() => expect(loadConversation(session.id)?.messages.map((m) => m.role)).toEqual(['user', 'event', 'user']))
  })
})

describe('parar', () => {
  it('marca "Interrompido", recusa a pergunta pendente e não mostra erro', async () => {
    const { session } = open()
    send(session, 'oi')
    await started()
    const reply = driver().events.permission({ toolName: 'command', label: 'Comando', summary: 'rm', canAlwaysAllow: true })
    expect(session.state.status).toBe('needs-you')
    await session.interrupt()
    expect(await reply).toBe('deny')
    await idle(session)
    expect(session.state.error).toBeUndefined()
    expect(session.state.permissions).toEqual([])
    expect(stored(session).messages.at(-1)).toMatchObject({ role: 'event', kind: 'interrupted' })
  })
})

describe('perguntas de permissão', () => {
  it.each([
    ['allow', 'allow'],
    ['always', 'always'],
    ['deny', 'deny']
  ] as const)('resposta %s chega ao agente como %s', async (answer, expected: PermissionReply) => {
    const { session } = open()
    send(session, 'oi')
    await started()
    const reply = driver().events.permission({ toolName: 'edit', label: 'Editar', summary: 'a.ts', canAlwaysAllow: true })
    const [request] = session.state.permissions
    expect(request).toMatchObject({ toolName: 'edit', summary: 'a.ts' })
    session.answer(request.id, answer)
    expect(await reply).toBe(expected)
    expect(session.state.status).toBe('running')
  })
})

describe('ferramentas', () => {
  it('a mesma chamada é atualizada no lugar, sem linha repetida', async () => {
    const { session } = open()
    send(session, 'oi')
    await started()
    driver().events.tool(tool())
    driver().events.tool(tool({ done: true, result: 'a.ts\nb.ts' }))
    driver().finish()
    await idle(session)
    const tools = stored(session).messages.filter((m) => m.role === 'tool')
    expect(tools).toEqual([expect.objectContaining({ toolUseId: 't1', result: 'a.ts\nb.ts' })])
  })

  it('texto antes de uma ferramenta vira mensagem própria, na ordem certa', async () => {
    const { session } = open()
    send(session, 'oi')
    await started()
    driver().events.text('Vou listar.')
    driver().events.tool(tool())
    driver().finish()
    await idle(session)
    expect(stored(session).messages.map((m) => m.role)).toEqual(['user', 'assistant', 'tool'])
  })

  it('etapa delegada mantém o resultado quando o agente atualiza a linha sem repetir', async () => {
    const { session } = open()
    send(session, 'oi')
    await started()
    driver().events.tool(tool({ id: 'd1', agent: 'Gemini', result: 'entregue', done: true }))
    driver().events.tool(tool({ id: 'd1', agent: 'Gemini', result: '', done: true }))
    driver().finish()
    await idle(session)
    expect(stored(session).messages.find((m) => m.role === 'tool')).toMatchObject({ result: 'entregue' })
  })
})

describe('retomar', () => {
  it('reabre com o agente e a conta gravados, e o agente retoma pelo id nativo', async () => {
    const id = '11111111-0000-4000-8000-000000000000'
    saveConversation({
      version: 1,
      id,
      provider: 'gemini',
      account: 'ab12cd34',
      cwd: '/Users/ana/proj',
      title: 'Antiga',
      createdAt: '2026-10-20T10:00:00.000Z',
      updatedAt: '2026-10-20T10:00:00.000Z',
      nativeId: 'sessao-gemini',
      contextPercent: 40,
      messages: [{ id: 'u1', role: 'user', text: 'antes', at: '2026-10-20T10:00:00.000Z' }]
    })
    const { session, seen } = open(CODEX, id)
    expect(session.account).toBe('gemini:ab12cd34')
    expect(session.state.sessionId).toBe(id)
    send(session, 'continua')
    expect(seen.identified).toEqual([])
    await started()
    expect(fake.provider).toBe('gemini')
    expect(driver().started).toEqual(['sessao-gemini'])
    driver().finish()
    await idle(session)
    expect(stored(session).messages.map((m) => ('text' in m ? m.text : ''))).toEqual(['antes', 'continua'])
  })
})

describe('agente calado', () => {
  it('Gemini sem sinal por 45 s explica o provável motivo, e o aviso some quando ele responde', async () => {
    vi.useFakeTimers()
    const { session } = open({ provider: 'gemini', account: 'main' })
    send(session, 'oi')
    await vi.advanceTimersByTimeAsync(45_000)
    expect(session.state.error).toMatch(/Gemini ainda não respondeu/)
    driver().events.text('oi!')
    expect(session.state.error).toBeUndefined()
    expect(session.state.status).toBe('running')
  })
})
