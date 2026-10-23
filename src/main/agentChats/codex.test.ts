import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatSettings } from '../../shared/chat'
import type { DriverEvents, PermissionAsk, PermissionReply, ToolEvent } from './driver'

// O app-server do Codex trocado por um falso: o teste manda os avisos que ele mandaria (formato
// conferido na 0.162.1, ver codex.ts) e confere o que a conversa recebe.

const fake = vi.hoisted(() => ({
  calls: [] as { method: string; params: Record<string, unknown> }[],
  rpc: null as null | {
    onNotification: (method: string, params: unknown) => void
    onRequest: (method: string, params: unknown) => Promise<unknown>
    onExit: (code: number | null) => void
  },
  error: ''
}))

vi.mock('../providers/env', () => ({ providerLaunch: () => ({ command: 'codex', args: [], env: {}, account: 'main' }) }))
vi.mock('../usageMonitor/codex', () => ({ reportCodexRateLimits: vi.fn() }))
vi.mock('../providers/status', () => ({
  openCodex: async () => {
    const rpc = {
      onNotification: () => {},
      onRequest: async () => undefined,
      onExit: () => {},
      lastError: () => fake.error,
      close: vi.fn(),
      request: async (method: string, params: Record<string, unknown>) => {
        fake.calls.push({ method, params })
        if (method === 'thread/start' || method === 'thread/resume') return { thread: { id: (params.threadId as string) ?? 'thread-new' } }
        if (method === 'turn/start') return { turn: { id: 'turn-1', status: 'inProgress' } }
        return {}
      }
    }
    fake.rpc = rpc
    return rpc
  }
}))

const { CodexDriver } = await import('./codex')

const settings = (extra: Partial<ChatSettings> = {}): ChatSettings => ({ model: '', effort: '', thinking: false, ultracode: false, permissionMode: 'default', ...extra })

function recorder(answer: PermissionReply = 'allow') {
  const log = { text: '', thought: '', textDone: 0, thoughtDone: 0, tools: [] as ToolEvent[], asks: [] as PermissionAsk[], titles: [] as string[], usage: [] as unknown[], exited: [] as (string | undefined)[] }
  const events: DriverEvents = {
    text: (d) => (log.text += d),
    textDone: () => log.textDone++,
    thought: (d) => (log.thought += d),
    thoughtDone: () => log.thoughtDone++,
    tool: (t) => log.tools.push(t),
    permission: async (ask) => (log.asks.push(ask), answer),
    title: (t) => log.titles.push(t),
    usage: (u) => log.usage.push(u),
    exited: (r) => log.exited.push(r)
  }
  return { log, events }
}

const notify = (method: string, params: unknown) => fake.rpc!.onNotification(method, params)
const ask = (method: string, params: unknown) => fake.rpc!.onRequest(method, params) as Promise<{ decision?: string }>
const lastCall = (method: string) => fake.calls.filter((c) => c.method === method).at(-1)?.params

async function opened(s = settings(), answer: PermissionReply = 'allow', folders: string[] = []) {
  const r = recorder(answer)
  const driver = new CodexDriver('main', '/Users/ana/proj', s, r.events, folders)
  await driver.start()
  return { driver, ...r }
}

beforeEach(() => {
  fake.calls = []
  fake.rpc = null
  fake.error = ''
})

describe('abrir e retomar', () => {
  it('conversa nova abre uma thread; retomada usa o id guardado', async () => {
    const { driver } = await opened()
    expect(fake.calls[0].method).toBe('thread/start')
    const again = new CodexDriver('main', '/Users/ana/proj', settings(), recorder().events)
    expect(await again.start('thread-antiga')).toBe('thread-antiga')
    expect(lastCall('thread/resume')).toMatchObject({ threadId: 'thread-antiga', cwd: '/Users/ana/proj' })
    driver.close()
  })
})

describe('modo de permissão vira a política do Codex', () => {
  it.each([
    ['default', 'on-request', 'workspaceWrite'],
    ['plan', 'on-request', 'readOnly'],
    ['bypassPermissions', 'never', 'dangerFullAccess']
  ])('%s', async (mode, approvalPolicy, sandbox) => {
    const { driver } = await opened(settings({ permissionMode: mode }))
    const done = driver.prompt({ text: 'oi', images: [] })
    await vi.waitFor(() => expect(lastCall('turn/start')).toBeDefined())
    notify('turn/completed', { turn: { id: 'turn-1', status: 'completed' } })
    await done
    expect(lastCall('turn/start')).toMatchObject({ approvalPolicy, sandboxPolicy: { type: sandbox } })
  })

  it('o workspace pode escrever nas outras pastas dele', async () => {
    const { driver } = await opened(settings(), 'allow', ['/Users/ana/lib'])
    const done = driver.prompt({ text: 'oi', images: [] })
    await vi.waitFor(() => expect(lastCall('turn/start')).toBeDefined())
    notify('turn/completed', { turn: { id: 'turn-1', status: 'completed' } })
    await done
    expect(lastCall('turn/start')).toMatchObject({ sandboxPolicy: { writableRoots: ['/Users/ana/lib'] } })
  })
})

describe('pedido', () => {
  it('manda texto, imagens, modelo e esforço, e termina no turn/completed', async () => {
    const { driver } = await opened(settings({ model: 'gpt-5.5', effort: 'high' }))
    const done = driver.prompt({ text: 'olha isso', images: [{ mediaType: 'image/png', data: 'AAA' }] })
    await vi.waitFor(() => expect(lastCall('turn/start')).toBeDefined())
    notify('turn/completed', { turn: { id: 'turn-1', status: 'completed' } })
    await done
    expect(lastCall('turn/start')).toMatchObject({
      model: 'gpt-5.5',
      effort: 'high',
      input: [{ type: 'text', text: 'olha isso' }, { type: 'image', url: 'data:image/png;base64,AAA' }]
    })
  })

  it('pedido que falhou vira erro com a mensagem do Codex', async () => {
    const { driver } = await opened()
    const done = driver.prompt({ text: 'oi', images: [] })
    await vi.waitFor(() => expect(lastCall('turn/start')).toBeDefined())
    notify('error', { error: { message: 'tentando de novo' }, willRetry: true })
    notify('error', { error: { message: 'Limite de uso atingido' }, willRetry: false })
    notify('turn/completed', { turn: { id: 'turn-1', status: 'failed', error: null } })
    await expect(done).rejects.toThrow('Limite de uso atingido')
  })

  it('o Codex fechando no meio termina o pedido com erro, em vez de esperar para sempre', async () => {
    const { driver, log } = await opened()
    const done = driver.prompt({ text: 'oi', images: [] })
    await vi.waitFor(() => expect(lastCall('turn/start')).toBeDefined())
    fake.error = 'segfault'
    fake.rpc!.onExit(1)
    await expect(done).rejects.toThrow('segfault')
    expect(log.exited).toEqual(['segfault'])
  })

  it('parar interrompe o turn em andamento', async () => {
    const { driver } = await opened()
    void driver.prompt({ text: 'oi', images: [] }).catch(() => {})
    await vi.waitFor(() => expect(lastCall('turn/start')).toBeDefined())
    await driver.cancel()
    expect(lastCall('turn/interrupt')).toEqual({ threadId: 'thread-new', turnId: 'turn-1' })
  })
})

describe('o que chega na conversa', () => {
  it('texto, raciocínio, título e uso do contexto', async () => {
    const { log } = await opened()
    notify('item/reasoning/summaryTextDelta', { delta: 'pensando' })
    notify('item/completed', { item: { type: 'reasoning', id: 'r1' } })
    notify('item/agentMessage/delta', { delta: 'Olá' })
    notify('item/agentMessage/delta', { delta: ', Ana' })
    notify('item/completed', { item: { type: 'agentMessage', id: 'm1' } })
    notify('thread/name/updated', { threadName: 'Arrumar login' })
    notify('thread/name/updated', { threadName: '' })
    notify('thread/tokenUsage/updated', { tokenUsage: { last: { totalTokens: 50_000, outputTokens: 300 }, modelContextWindow: 200_000 } })
    expect(log).toMatchObject({ text: 'Olá, Ana', thought: 'pensando', textDone: 1, thoughtDone: 1, titles: ['Arrumar login'] })
    expect(log.usage).toEqual([{ contextPercent: 25, turnTokens: 300 }])
  })

  it('comando: começa sem resultado e termina com a saída; saída diferente de zero é erro', async () => {
    const { log } = await opened()
    notify('item/started', { item: { type: 'commandExecution', id: 'c1', command: 'pnpm test' } })
    notify('item/completed', { item: { type: 'commandExecution', id: 'c1', command: 'pnpm test', exitCode: 1, aggregatedOutput: 'falhou' } })
    expect(log.tools.map(({ name, input, result, error, done }) => ({ name, input, result, error, done }))).toEqual([
      { name: 'command', input: 'pnpm test', result: undefined, error: false, done: false },
      { name: 'command', input: 'pnpm test', result: 'falhou', error: true, done: true }
    ])
  })

  it('edição mostra os arquivos e o diff', async () => {
    const { log } = await opened()
    const changes = [
      { path: '/Users/ana/proj/src/a.ts', diff: '@@ -1 +1 @@\n-a\n+b' },
      { path: '/Users/ana/proj/src/b.ts', diff: '' }
    ]
    notify('item/started', { item: { type: 'fileChange', id: 'f1', changes } })
    expect(log.tools[0]).toMatchObject({ name: 'edit', input: 'a.ts, b.ts', diff: [{ oldStart: 1, newStart: 1, lines: ['-a', '+b'] }] })
  })

  it('chamada da delegate do Argus vira a linha de subagente', async () => {
    const { log } = await opened()
    const item = { type: 'mcpToolCall', id: 'd1', server: 'argus', tool: 'delegate', arguments: { agent: 'gemini', model: 'gemini-3-flash', task: 'Revisar o PR\ncom calma', title: '' } }
    notify('item/completed', { item: { ...item, status: 'completed', result: { content: [{ type: 'text', text: 'feito' }] } } })
    expect(log.tools[0]).toMatchObject({ label: 'Delegar', input: 'Revisar o PR', agent: 'Gemini - gemini-3-flash', delegateTask: 'Revisar o PR\ncom calma', result: 'feito' })
  })

  it('tipo de item desconhecido não vira linha nenhuma', async () => {
    const { log } = await opened()
    notify('item/started', { item: { type: 'algoNovo', id: 'x' } })
    expect(log.tools).toEqual([])
  })
})

describe('aprovações', () => {
  it.each([
    ['allow', 'accept'],
    ['always', 'acceptForSession'],
    ['deny', 'decline']
  ] as const)('comando com resposta %s → %s', async (answer, decision) => {
    const { log } = await opened(settings(), answer)
    expect(await ask('item/commandExecution/requestApproval', { command: 'rm -rf build', reason: 'Limpar o build' })).toEqual({ decision })
    expect(log.asks[0]).toMatchObject({ toolName: 'command', summary: 'Limpar o build', detail: 'rm -rf build' })
  })

  it('edição pergunta com o diff visto quando ela começou', async () => {
    const { log } = await opened()
    notify('item/started', { item: { type: 'fileChange', id: 'f1', changes: [{ path: '/p/a.ts', diff: '@@ -1 +1 @@\n-a\n+b' }] } })
    await ask('item/fileChange/requestApproval', { itemId: 'f1' })
    expect(log.asks[0]).toMatchObject({ toolName: 'edit', summary: 'a.ts', diff: [{ lines: ['-a', '+b'] }] })
  })

  it('pergunta das ferramentas do próprio Argus é aceita sem incomodar', async () => {
    const { log } = await opened()
    expect(await ask('mcpServer/elicitation/request', { serverName: 'argus' })).toEqual({ action: 'accept', content: {} })
    expect(log.asks).toEqual([])
  })

  it('pergunta de outro servidor MCP não é aceita sozinha', async () => {
    await opened()
    await expect(ask('mcpServer/elicitation/request', { serverName: 'outro' })).rejects.toThrow('não suportado')
  })
})
