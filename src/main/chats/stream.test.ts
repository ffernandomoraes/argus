import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import { describe, expect, it } from 'vitest'
import type { ChatState } from '../../shared/chat'
import { newReader, readMessage, type ReadContext, type Reader } from './stream'

// Mensagens do SDK como o Claude Code manda, só com os campos que o leitor usa.
const sdk = (m: Record<string, unknown>) => m as unknown as SDKMessage
const event = (e: Record<string, unknown>, parent: string | null = null) => sdk({ type: 'stream_event', event: e, parent_tool_use_id: parent })

const idle = (patch: Partial<ChatState> = {}): ChatState => ({
  status: 'idle',
  partial: '',
  permissions: [],
  revision: 0,
  turnTokens: 0,
  agents: [],
  backgroundTasks: 0,
  ...patch
})

const ctx = (patch: Partial<ReadContext> = {}): ReadContext => ({ now: 1000, waiting: 0, interrupted: false, resumes: false, cwd: '/repo', ...patch })

// Aplica uma sequência de mensagens como a ChatSession faz: o patch vai para o estado e o leitor segue.
function play(messages: SDKMessage[], start: ChatState = idle(), context: Partial<ReadContext> = {}) {
  let chat = start
  let reader: Reader = newReader()
  const steps = messages.map((m) => {
    const step = readMessage(m, chat, reader, ctx(context))
    reader = step.reader
    chat = { ...chat, ...step.patch }
    return step
  })
  return { chat, reader, steps }
}

describe('readMessage: começo e fim do pedido', () => {
  it('pedido que o app não viu começar (remote control, fila) começa a contar ali', () => {
    const { chat, steps } = play([event({ type: 'message_start' })])
    expect(steps[0].turnStarted).toBe(true)
    expect(chat.status).toBe('running')
    expect(chat.turnStartedAt).toBe(1000)
    expect(chat.activity?.kind).toBe('thinking')
  })

  it('com permissão esperando, começa como "precisa de você"', () => {
    const { chat } = play([event({ type: 'message_start' })], idle(), { waiting: 1 })
    expect(chat.status).toBe('needs-you')
  })

  it('o texto chegando aos pedaços vira a prévia, e a resposta seguinte começa do zero', () => {
    const { chat } = play([
      event({ type: 'message_start' }),
      event({ type: 'content_block_start', content_block: { type: 'text' } }),
      event({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'Olá, ' } }),
      event({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'tudo bem?' } })
    ])
    expect(chat.partial).toBe('Olá, tudo bem?')
    expect(chat.activity?.kind).toBe('writing')
    const next = play([event({ type: 'message_start' })], chat)
    expect(next.chat.partial).toBe('')
  })

  it('soma os tokens das respostas do mesmo pedido', () => {
    const { chat } = play([
      event({ type: 'message_start' }),
      event({ type: 'message_delta', usage: { output_tokens: 120 } }),
      event({ type: 'message_start' }),
      event({ type: 'message_delta', usage: { output_tokens: 30 } })
    ])
    expect(chat.turnTokens).toBe(150)
  })

  it('o fim do pedido volta para parado e pede para reler o histórico', () => {
    const { chat, steps } = play(
      [sdk({ type: 'result', subtype: 'success', is_error: false, result: 'ok', modelUsage: { 'claude-opus-5-5': { contextWindow: 1_000_000 } } })],
      idle({ status: 'running', turnStartedAt: 1, revision: 4, activity: { kind: 'writing', since: 1 } })
    )
    expect(steps[0].turnEnded).toBe(true)
    expect(steps[0].contextWindows).toEqual([['claude-opus-5-5', 1_000_000]])
    expect(chat).toMatchObject({ status: 'idle', turnStartedAt: undefined, activity: undefined, revision: 5, error: undefined })
  })

  it('erro do Claude aparece na conversa, mas a parada pedida por você não é erro', () => {
    const failure = sdk({ type: 'result', subtype: 'error_during_execution', is_error: true })
    expect(play([failure], idle({ status: 'running' })).chat.error).toBe('O Claude parou com erro.')
    expect(play([failure], idle({ status: 'running' }), { interrupted: true }).chat.error).toBeUndefined()
  })

  it('parado com mensagem sua na fila, o fim emenda no pedido seguinte', () => {
    const { chat } = play([sdk({ type: 'result', subtype: 'success', is_error: false })], idle({ status: 'running' }), { resumes: true })
    expect(chat.status).toBe('running')
  })

  it('no fim do pedido só os subagentes em segundo plano continuam', () => {
    const agent = (id: string, background: boolean) => ({ id, agent: 'x', description: '', startedAt: 0, toolUses: 0, steps: [], background })
    const { chat } = play([sdk({ type: 'result', subtype: 'success', is_error: false })], idle({ status: 'running', agents: [agent('a', false), agent('b', true)] }))
    expect(chat.agents.map((a) => a.id)).toEqual(['b'])
  })
})

describe('readMessage: ferramentas', () => {
  it('mostra a ferramenta sendo preparada e o alvo assim que o campo fecha', () => {
    const start = [
      event({ type: 'message_start' }),
      event({ type: 'content_block_start', content_block: { type: 'tool_use', name: 'Read' } }),
      event({ type: 'content_block_delta', delta: { type: 'input_json_delta', partial_json: '{"file_path":"/Users/ana/proj/src/ap' } })
    ]
    const open = play(start)
    expect(open.chat.activity).toMatchObject({ kind: 'preparing', tool: 'Ler' })
    expect(open.chat.activity?.summary).toBeUndefined()
    const closed = play([...start, event({ type: 'content_block_delta', delta: { type: 'input_json_delta', partial_json: 'p.ts"' } })])
    expect(closed.chat.activity).toMatchObject({ kind: 'preparing', tool: 'Ler', summary: 'app.ts' })
  })

  it('pedido da ferramenta pronto: ela passa a rodar', () => {
    const { chat, steps } = play([
      event({ type: 'message_start' }),
      event({ type: 'content_block_start', content_block: { type: 'tool_use', name: 'Bash' } }),
      event({ type: 'content_block_stop' })
    ])
    expect(chat.activity?.kind).toBe('running')
    expect(steps[2].urgent).toBe(true)
  })

  it('ferramentas em paralelo: o resultado da anterior no meio da montagem não apaga o nome da seguinte', () => {
    const { chat } = play([
      event({ type: 'message_start' }),
      event({ type: 'content_block_start', content_block: { type: 'tool_use', name: 'Read' } }),
      event({ type: 'content_block_stop' }),
      event({ type: 'content_block_start', content_block: { type: 'tool_use', name: 'Bash' } }),
      event({ type: 'content_block_delta', delta: { type: 'input_json_delta', partial_json: '{"command":"ls","description":"Listar"' } }),
      sdk({ type: 'user', parent_tool_use_id: null, message: { content: [{ type: 'tool_result', tool_use_id: 't1' }] } }),
      event({ type: 'content_block_stop' })
    ])
    expect(chat.activity).toMatchObject({ kind: 'running', tool: 'Comando', summary: 'Listar' })
  })

  it('o resultado da ferramenta volta para "pensando" e relê o histórico', () => {
    const start = idle({ status: 'running', revision: 2, activity: { kind: 'running', tool: 'Comando', since: 1 } })
    const { chat } = play([sdk({ type: 'user', parent_tool_use_id: null, message: { content: [{ type: 'tool_result', tool_use_id: 't1' }] } })], start)
    expect(chat.activity?.kind).toBe('thinking')
    expect(chat.revision).toBe(3)
  })

  it('o que acontece por dentro de um subagente não mexe na conversa', () => {
    const start = idle({ status: 'running', partial: 'resposta', revision: 2 })
    const { chat } = play(
      [
        event({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'do subagente' } }, 'task-1'),
        sdk({ type: 'user', parent_tool_use_id: 'task-1', message: { content: 'x' } })
      ],
      start
    )
    expect(chat.partial).toBe('resposta')
    expect(chat.revision).toBe(2)
  })
})

describe('readMessage: avisos do sistema', () => {
  it('o init informa o id da sessão', () => {
    const { steps, chat } = play([sdk({ type: 'system', subtype: 'init', session_id: 'sess-1' })])
    expect(steps[0].sessionId).toBe('sess-1')
    expect(chat.sessionId).toBe('sess-1')
  })

  it('a compactação relê o histórico para mostrar o divisor', () => {
    expect(play([sdk({ type: 'system', subtype: 'compact_boundary' })], idle({ revision: 7 })).chat.revision).toBe(8)
  })

  // 83e5b01: o início de cada tarefa é a primeira vez que ela aparece, para mostrar há quanto tempo roda.
  it('tarefas em segundo plano guardam quando apareceram, e subagentes e ambientes não contam', () => {
    const tasks = (list: Record<string, unknown>[]) => sdk({ type: 'system', subtype: 'background_tasks_changed', tasks: list })
    const first = play([tasks([{ task_id: 'a' }, { task_id: 'sub', task_type: 'local_agent' }, { task_id: 'env', ambient: true }])])
    expect(first.chat.backgroundTasks).toBe(1)
    expect(first.chat.backgroundStarts).toEqual({ a: 1000 })
    const later = readMessage(tasks([{ task_id: 'a' }, { task_id: 'b' }]), first.chat, newReader(), ctx({ now: 5000 }))
    expect(later.patch?.backgroundStarts).toEqual({ a: 1000, b: 5000 })
  })

  it('a lista de tarefas igual não gera estado novo; uma trocada por outra, sim', () => {
    const chat = idle({ backgroundTasks: 1, backgroundStarts: { a: 1 }, backgroundInfo: { a: { description: '', type: '' } } })
    const tasks = (id: string) => sdk({ type: 'system', subtype: 'background_tasks_changed', tasks: [{ task_id: id }] })
    expect(readMessage(tasks('a'), chat, newReader(), ctx()).patch).toBeUndefined()
    expect(readMessage(tasks('b'), chat, newReader(), ctx()).patch?.backgroundStarts).toEqual({ b: 1000 })
  })

  it('estado do remote control só muda com ele ligado', () => {
    const bridge = sdk({ type: 'system', subtype: 'bridge_state', state: 'connected' })
    expect(play([bridge]).chat.remote).toBeUndefined()
    expect(play([bridge], idle({ remote: { status: 'connecting', url: 'u' } })).chat.remote).toEqual({ status: 'connected', url: 'u', detail: undefined })
  })

  it('a sugestão de mensagem só vale se nenhum pedido novo começou', () => {
    const suggestion = sdk({ type: 'prompt_suggestion', suggestion: 'roda os testes' })
    expect(play([suggestion]).chat.suggestion).toBe('roda os testes')
    expect(play([suggestion], idle({ status: 'running', turnStartedAt: 5 })).chat.suggestion).toBeUndefined()
  })
})

describe('readMessage: nova tentativa da API e compactação', () => {
  const retry = (m: Record<string, unknown>) =>
    sdk({ type: 'system', subtype: 'api_retry', attempt: 2, max_retries: 10, retry_delay_ms: 8000, error_status: null, error: 'unknown', ...m })

  it('a nova tentativa traz o motivo, a tentativa e quando sai', () => {
    const { chat } = play([retry({ error: 'overloaded', error_status: 529 })])
    expect(chat.retry).toEqual({ cause: 'overloaded', attempt: 2, maxRetries: 10, at: 9000 })
  })

  it('o motivo vem do código HTTP quando o erro não diz', () => {
    expect(play([retry({ error_status: 429 })]).chat.retry?.cause).toBe('rate_limit')
    expect(play([retry({ error_status: 503 })]).chat.retry?.cause).toBe('server_error')
    expect(play([retry({ no_response: { waited_ms: 1, retry_wait_ms: 2 } })]).chat.retry?.cause).toBe('no_response')
    expect(play([retry({ error_status: 400 })]).chat.retry?.cause).toBe('other')
  })

  it('a resposta começando tira o aviso da nova tentativa', () => {
    const { chat } = play([retry({}), event({ type: 'message_start' })])
    expect(chat.retry).toBeUndefined()
  })

  it('compactação: marca o começo e sai com o divisor gravado ou com o status de volta', () => {
    const status = (s: string | null) => sdk({ type: 'system', subtype: 'status', status: s })
    expect(play([status('compacting')]).chat.compactingSince).toBe(1000)
    expect(play([status('compacting'), status(null)]).chat.compactingSince).toBeUndefined()
    expect(play([status('compacting'), sdk({ type: 'system', subtype: 'compact_boundary' })]).chat.compactingSince).toBeUndefined()
  })

  it('o fim do pedido limpa os dois', () => {
    const { chat } = play([
      retry({}),
      sdk({ type: 'system', subtype: 'status', status: 'compacting' }),
      sdk({ type: 'result', subtype: 'success', is_error: false, modelUsage: {} })
    ])
    expect(chat.retry).toBeUndefined()
    expect(chat.compactingSince).toBeUndefined()
  })
})

describe('readMessage: worktree', () => {
  const entered = { worktreePath: '/repo-ui', worktreeBranch: 'feat/ui', message: 'Entered worktree at “/repo-ui”.' }
  const result = (parent: string | null) =>
    sdk({ type: 'user', parent_tool_use_id: parent, message: { content: [{ type: 'tool_result', tool_use_id: 't1' }] }, tool_use_result: entered })

  it('o Claude entrou num worktree: a conversa vai junto, saindo da pasta da sessão', () => {
    expect(play([result(null)]).chat.worktree).toEqual({ path: '/repo-ui', from: '/repo', branch: 'feat/ui' })
  })

  it('o subagente que entra num worktree não leva a conversa', () => {
    expect(play([result('task-1')]).chat.worktree).toBeUndefined()
  })
})

describe('tarefas em segundo plano: descrição e arquivo da saída', () => {
  it('guarda a descrição da lista e o arquivo lido do resultado do comando', async () => {
    const { backgroundInfo, outputFiles } = await import('./stream')
    const files = outputFiles(undefined, [
      { type: 'tool_result', tool_use_id: 't1', content: 'Command running in background with ID: b1. Output is being written to: /tmp/claude-1/-p/s/tasks/b1.output. You will be notified.' }
    ])
    expect(files).toEqual({ b1: { description: '', type: 'local_bash', outputFile: '/tmp/claude-1/-p/s/tasks/b1.output' } })
    const listed = backgroundInfo(files ?? undefined, [{ task_id: 'b1', task_type: 'local_bash', description: 'Sobe o servidor' }])
    expect(listed).toEqual({ b1: { description: 'Sobe o servidor', type: 'local_bash', outputFile: '/tmp/claude-1/-p/s/tasks/b1.output' } })
    // Saiu da lista: deixa de valer. Mesma lista: a mesma referência.
    expect(backgroundInfo(listed, [{ task_id: 'b1', task_type: 'local_bash', description: 'Sobe o servidor' }])).toBe(listed)
    expect(backgroundInfo(listed, [])).toEqual({})
  })
})
