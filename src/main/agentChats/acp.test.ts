import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatSettings } from '../../shared/chat'
import type { DriverEvents, PermissionAsk, PermissionReply, ToolEvent } from './driver'

// Gemini e Cursor pelo ACP, com o processo do agente trocado por um falso: o teste responde aos
// pedidos e manda os avisos session/update como o agente mandaria (ver acp.ts).

type Params = Record<string, unknown>
const fake = vi.hoisted(() => ({
  calls: [] as { method: string; params: Params }[],
  replies: {} as Record<string, unknown>,
  rpc: null as null | {
    onNotification: (method: string, params: unknown) => void
    onRequest: (method: string, params: unknown) => Promise<unknown>
  }
}))

vi.mock('../providers/env', () => ({ providerLaunch: () => ({ command: 'agent', args: [], env: {}, account: 'main' }) }))
vi.mock('../workspaces', () => ({ trustGemini: () => {} }))
vi.mock('../providers/rpc', async () => {
  const { RpcError } = await vi.importActual<typeof import('../providers/rpc')>('../providers/rpc')
  class JsonRpcProcess {
    onNotification: (method: string, params: unknown) => void = () => {}
    onRequest: (method: string, params: unknown) => Promise<unknown> = async () => undefined
    onExit: () => void = () => {}
    constructor() {
      fake.rpc = this
    }
    lastError = () => ''
    close() {}
    notify(method: string, params: Params) {
      fake.calls.push({ method, params })
    }
    async request(method: string, params: Params) {
      fake.calls.push({ method, params })
      const reply = fake.replies[method]
      if (reply instanceof Error) throw reply
      return typeof reply === 'function' ? reply(params) : (reply ?? {})
    }
  }
  return { RpcError, JsonRpcProcess }
})

const { AcpDriver, launchArgs } = await import('./acp')
const { RpcError } = await import('../providers/rpc')

const settings = (extra: Partial<ChatSettings> = {}): ChatSettings => ({ model: '', effort: '', thinking: false, ultracode: false, permissionMode: 'default', ...extra })

function recorder(answer: PermissionReply = 'allow') {
  const log = { order: [] as string[], text: '', tools: [] as ToolEvent[], asks: [] as PermissionAsk[], titles: [] as string[], usage: [] as unknown[] }
  const events: DriverEvents = {
    text: (d) => (log.order.push('text'), (log.text += d)),
    textDone: () => log.order.push('textDone'),
    thought: () => log.order.push('thought'),
    thoughtDone: () => log.order.push('thoughtDone'),
    tool: (t) => log.tools.push(t),
    permission: async (ask) => (log.asks.push(ask), answer),
    title: (t) => log.titles.push(t),
    usage: (u) => log.usage.push(u),
    exited: () => {}
  }
  return { log, events }
}

const SESSION = { sessionId: 's1', modes: { currentModeId: 'default', availableModes: [{ id: 'default', name: 'Default' }, { id: 'autoEdit', name: 'Auto edit' }, { id: 'yolo', name: 'YOLO' }, { id: 'plan', name: 'Plan' }] } }

async function opened(provider: 'gemini' | 'cursor' = 'cursor', s = settings(), answer: PermissionReply = 'allow', nativeId?: string) {
  const r = recorder(answer)
  const driver = new AcpDriver(provider, 'main', '/Users/ana/proj', s, r.events)
  await driver.start(nativeId)
  return { driver, ...r }
}

const update = (u: Params) => fake.rpc!.onNotification('session/update', { sessionId: 's1', update: u })
const permission = (p: Params) => fake.rpc!.onRequest('session/request_permission', p) as Promise<{ outcome: { outcome: string; optionId?: string } }>
const calls = (method: string) => fake.calls.filter((c) => c.method === method).map((c) => c.params)

const OPTIONS = [
  { optionId: 'yes', kind: 'allow_once', name: 'Allow' },
  { optionId: 'always', kind: 'allow_always', name: 'Always' },
  { optionId: 'no', kind: 'reject_once', name: 'Reject' }
]

beforeEach(() => {
  fake.calls = []
  fake.rpc = null
  fake.replies = { 'session/new': SESSION, 'session/load': { modes: SESSION.modes } }
})

describe('abrir', () => {
  it('Gemini abre com --acp; Cursor, com as pastas antes do acp', () => {
    expect(launchArgs('gemini', ['/a'])).toEqual(['--acp', '--include-directories', '/a'])
    expect(launchArgs('cursor', ['/a'])).toEqual(['--add-dir', '/a', 'acp'])
  })

  it('conversa retomada: a conversa antiga que o agente reenvia não aparece de novo', async () => {
    fake.replies['session/load'] = (p: Params) => {
      update({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'resposta velha' } })
      return { modes: SESSION.modes, sessionId: p.sessionId }
    }
    const { driver, log } = await opened('cursor', settings(), 'allow', 'sessao-antiga')
    expect(calls('session/load')[0]).toMatchObject({ sessionId: 'sessao-antiga', cwd: '/Users/ana/proj' })
    expect(log.text).toBe('')
    update({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'nova' } })
    expect(log.text).toBe('nova')
    driver.close()
  })

  it.each([
    ['default', 'default'],
    ['acceptEdits', 'autoEdit'],
    ['bypassPermissions', 'yolo'],
    ['plan', 'plan']
  ])('modo %s do app vira o modo %s do agente', async (mode, agentMode) => {
    await opened('gemini', settings({ permissionMode: mode }))
    expect(calls('session/set_mode').at(-1)).toEqual({ sessionId: 's1', modeId: agentMode })
  })

  // O "auto" do Gemini escolhe um Pro sem cota na chave gratuita e fica tentando calado (ver acp.ts).
  it('Gemini sem modelo escolhido abre no Flash que responde no plano gratuito', async () => {
    fake.replies['session/new'] = { ...SESSION, models: { currentModelId: 'auto', availableModels: [{ modelId: 'auto', name: 'Auto' }, { modelId: 'gemini-3.5-flash', name: 'Flash' }] } }
    await opened('gemini')
    expect(calls('session/set_model')).toEqual([{ sessionId: 's1', modelId: 'gemini-3.5-flash' }])
  })

  it('Cursor: modelo e modo pelas opções de configuração, sem repetir o que já vale', async () => {
    fake.replies['session/new'] = {
      sessionId: 's1',
      configOptions: [
        { id: 'model', name: 'Model', type: 'select', currentValue: 'gpt-5', options: [{ value: 'gpt-5', name: 'GPT-5' }, { value: 'sonnet', name: 'Sonnet' }] },
        { id: 'mode', name: 'Mode', type: 'select', currentValue: 'agent', options: [{ value: 'agent', name: 'Agent' }, { value: 'plan', name: 'Plan' }] }
      ]
    }
    const { driver } = await opened('cursor', settings({ model: 'sonnet' }))
    expect(calls('session/set_config_option')).toEqual([{ sessionId: 's1', configId: 'model', value: 'sonnet' }])
    await driver.configure(settings({ model: 'sonnet', permissionMode: 'plan' }))
    expect(calls('session/set_config_option').at(-1)).toEqual({ sessionId: 's1', configId: 'mode', value: 'plan' })
  })
})

describe('o que chega na conversa', () => {
  it('texto e raciocínio alternados fecham um antes de abrir o outro', async () => {
    const { log } = await opened()
    update({ sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: 'hmm' } })
    update({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Olá' } })
    update({ sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: 'mais' } })
    expect(log.order).toEqual(['thought', 'thoughtDone', 'text', 'textDone', 'thought'])
  })

  it('fim do pedido fecha o texto em andamento', async () => {
    fake.replies['session/prompt'] = () => {
      update({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'pronto' } })
      return { stopReason: 'end_turn' }
    }
    const { driver, log } = await opened()
    await driver.prompt({ text: 'oi', images: [{ mediaType: 'image/png', data: 'AAA' }] })
    expect(calls('session/prompt')[0].prompt).toEqual([{ type: 'text', text: 'oi' }, { type: 'image', mimeType: 'image/png', data: 'AAA' }])
    expect(log.order).toEqual(['text', 'textDone'])
  })

  it('recusa do agente vira erro', async () => {
    fake.replies['session/prompt'] = { stopReason: 'refusal' }
    const { driver } = await opened()
    await expect(driver.prompt({ text: 'x', images: [] })).rejects.toThrow('O agente recusou o pedido.')
  })

  it('título e uso do contexto', async () => {
    const { log } = await opened()
    update({ sessionUpdate: 'session_info_update', title: 'Revisar PR' })
    update({ sessionUpdate: 'usage_update', used: 30_000, size: 120_000 })
    update({ sessionUpdate: 'usage_update', used: 0, size: 0 })
    expect(log.titles).toEqual(['Revisar PR'])
    expect(log.usage).toEqual([{ contextPercent: 25 }])
  })

  it('comando: a atualização final junta a saída e marca o erro pelo código de saída', async () => {
    const { log } = await opened()
    update({ sessionUpdate: 'tool_call', toolCallId: 't1', kind: 'execute', title: '`pnpm test`', status: 'in_progress', rawInput: { command: 'pnpm test' } })
    update({ sessionUpdate: 'tool_call_update', toolCallId: 't1', status: 'completed', rawOutput: { exitCode: 1, stdout: 'saída', stderr: 'falhou' } })
    expect(log.tools.at(-1)).toMatchObject({ name: 'command', label: 'Comando', input: 'pnpm test', result: 'saída\nfalhou', error: true, done: true })
  })

  it('edição com texto antigo e novo vira diff, e a atualização sem conteúdo mantém o diff', async () => {
    const { log } = await opened()
    update({ sessionUpdate: 'tool_call', toolCallId: 'e1', kind: 'edit', locations: [{ path: '/Users/ana/proj/a.ts' }], content: [{ type: 'diff', path: '/Users/ana/proj/a.ts', oldText: 'a\n', newText: 'b\n' }] })
    update({ sessionUpdate: 'tool_call_update', toolCallId: 'e1', status: 'completed' })
    expect(log.tools.at(-1)).toMatchObject({ name: 'edit', input: 'a.ts', done: true, diff: [{ lines: ['-a', '+b'] }] })
  })
})

describe('permissões', () => {
  const editCall = { toolCallId: 'e1', kind: 'edit', title: 'Edit a.ts', locations: [{ path: '/p/a.ts' }] }

  it('pergunta e responde com a opção do agente que corresponde', async () => {
    const { log } = await opened('cursor', settings(), 'always')
    expect(await permission({ toolCall: editCall, options: OPTIONS })).toEqual({ outcome: { outcome: 'selected', optionId: 'always' } })
    expect(log.asks[0]).toMatchObject({ toolName: 'edit', summary: 'Edit a.ts', canAlwaysAllow: true })
  })

  it('negar escolhe a recusa; sem opção de recusa, cancela', async () => {
    await opened('cursor', settings(), 'deny')
    expect(await permission({ toolCall: editCall, options: OPTIONS })).toEqual({ outcome: { outcome: 'selected', optionId: 'no' } })
    expect(await permission({ toolCall: editCall, options: OPTIONS.slice(0, 2) })).toEqual({ outcome: { outcome: 'cancelled' } })
  })

  it('"Aceitar edições" libera edição sozinho, mas ainda pergunta comando', async () => {
    const { log } = await opened('cursor', settings({ permissionMode: 'acceptEdits' }))
    await permission({ toolCall: editCall, options: OPTIONS })
    expect(log.asks).toEqual([])
    await permission({ toolCall: { toolCallId: 'c1', kind: 'execute', title: 'rm', rawInput: { command: 'rm -rf x' } }, options: OPTIONS })
    expect(log.asks.map((a) => a.toolName)).toEqual(['command'])
  })

  it('"Ignorar permissões" libera tudo sem perguntar', async () => {
    const { log } = await opened('cursor', settings({ permissionMode: 'bypassPermissions' }))
    expect(await permission({ toolCall: { toolCallId: 'c1', kind: 'execute', title: 'rm' }, options: OPTIONS })).toEqual({ outcome: { outcome: 'selected', optionId: 'yes' } })
    expect(log.asks).toEqual([])
  })

  it('ferramenta do próprio Argus passa sem perguntar', async () => {
    const { log } = await opened()
    await permission({ toolCall: { toolCallId: 'd1', title: 'argus-delegate: delegate', kind: 'other' }, options: OPTIONS })
    expect(log.asks).toEqual([])
  })

  // Segurança: só o servidor do Argus passa direto; um arquivo numa pasta "argus" é outra coisa.
  it('arquivo ou comando com "argus" no nome continua perguntando', async () => {
    const { log } = await opened()
    await permission({ toolCall: { toolCallId: 'e2', kind: 'edit', title: 'argus: editar config', locations: [{ path: '/argus/a.ts' }] }, options: OPTIONS })
    await permission({ toolCall: { toolCallId: 'c2', kind: 'execute', title: 'argus-x run', rawInput: { command: 'argus-x run', providerIdentifier: 'argus' } }, options: OPTIONS })
    expect(log.asks).toHaveLength(2)
  })

  it('o motivo da pergunta não aparece como resultado da ferramenta', async () => {
    const { log } = await opened()
    await permission({ toolCall: { ...editCall, content: [{ type: 'content', content: { type: 'text', text: 'Not in allowlist: echo' } }] }, options: OPTIONS })
    expect(log.tools.at(-1)?.result).toBeUndefined()
  })
})

describe('erros em português', () => {
  it('Gemini sem cota explica o que fazer', async () => {
    fake.replies['session/new'] = new RpcError('Request failed', 429, { message: 'RESOURCE_EXHAUSTED: quota exceeded' })
    await expect(opened('gemini')).rejects.toThrow(/sem cota para este modelo/)
  })

  it('Cursor deslogado pede para entrar de novo', async () => {
    fake.replies['session/new'] = new RpcError('Unauthorized', -32000)
    await expect(opened('cursor')).rejects.toThrow(/pediu login de novo/)
  })

  it('erro desconhecido passa com a mensagem do agente', async () => {
    fake.replies['session/new'] = new RpcError('algo estranho', -32000)
    await expect(opened('cursor')).rejects.toThrow('algo estranho')
  })
})
