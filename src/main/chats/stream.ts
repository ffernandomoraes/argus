import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import type { ChatActivity, ChatState, RemoteControl } from '../../shared/chat'
import { describeTool } from '../toolLabels'
import { finishedAgents, subagentSteps, taskChange, type AgentsChange, type TaskMessage } from './subagents'
import { closedFields, TOOL_INPUT_SCAN } from './toolPreview'

// Lê uma mensagem do SDK e diz o que muda na conversa, sem tocar em nada: a ChatSession aplica.

type Line = Record<string, any>
type StreamEvent = Extract<SDKMessage, { type: 'stream_event' }>['event']
type Transcript = Extract<SDKMessage, { type: 'assistant' | 'user' }>
type Result = Extract<SDKMessage, { type: 'result' }>

// O que o leitor guarda de uma mensagem para a outra, além do estado da tela.
export type Reader = {
  // Tokens do pedido em andamento: respostas já fechadas + a que está sendo escrita.
  closedTokens: number
  currentTokens: number
  // Bloco sendo escrito agora e, se for ferramenta, o pedido dela chegando aos pedaços.
  block: string
  toolName: string
  toolInput: string
}

export const newReader = (): Reader => ({ closedTokens: 0, currentTokens: 0, block: '', toolName: '', toolInput: '' })

// O que vem de fora da mensagem.
export type ReadContext = {
  now: number
  // Pedidos de permissão esperando resposta.
  waiting: number
  // Parada pedida por você: o fim do pedido não é erro.
  interrupted: boolean
  // Parado com mensagem sua ainda na fila do Claude: o fim do pedido emenda no seguinte.
  resumes: boolean
}

export type Step = {
  reader: Reader
  patch?: Partial<ChatState>
  // Vai para a tela na hora; sem isso, junta com as próximas (texto chegando aos pedaços).
  urgent?: boolean
  // Id da sessão que o Claude informou: vira mais uma chave da conversa.
  sessionId?: string
  // Janela de contexto de cada modelo, informada no fim do pedido.
  contextWindows?: [model: string, tokens: number][]
  // Começou um pedido que o app não viu começar (remote control, mensagem que esperava na fila).
  turnStarted?: boolean
  // O pedido terminou (result).
  turnEnded?: boolean
}

export function readMessage(m: SDKMessage, chat: ChatState, reader: Reader, ctx: ReadContext): Step {
  if (m.type === 'system') return readSystem(m as Line, chat, reader, ctx.now)
  // Por dentro de um subagente o texto não é desta conversa.
  if (m.type === 'stream_event') return m.parent_tool_use_id ? { reader } : readStream(m.event, chat, reader, ctx)
  if (m.type === 'assistant' || m.type === 'user') return readTranscript(m, chat, reader, ctx.now)
  if (m.type === 'result') return readResult(m, chat, reader, ctx)
  return { reader }
}

// Mesma etapa continua contando do começo dela (ex.: pensando antes e durante o raciocínio).
function activity(current: ChatActivity | undefined, kind: ChatActivity['kind'], now: number): ChatActivity {
  const since = current?.kind === kind && current.tool === undefined ? current.since : now
  return { kind, tool: undefined, summary: undefined, since }
}

const agentsStep = (reader: Reader, change: AgentsChange): Step =>
  change ? { reader, patch: { agents: change.agents }, urgent: change.urgent } : { reader }

function readSystem(m: Line, chat: ChatState, reader: Reader, now: number): Step {
  if (m.subtype === 'init') return { reader, sessionId: m.session_id, patch: { sessionId: m.session_id }, urgent: true }
  if (m.subtype === 'bridge_state') {
    // Estado da conexão do remote control (ready, connected, failed...). Fica fora dos tipos do
    // SDK, como o pedido (ver remote.ts).
    if (!chat.remote) return { reader }
    const status: RemoteControl['status'] =
      m.state === 'connected' ? 'connected' : m.state === 'failed' ? 'failed' : 'connecting'
    return { reader, patch: { remote: { ...chat.remote, status, detail: m.detail } }, urgent: true }
  }
  if (typeof m.subtype === 'string' && m.subtype.startsWith('task_')) {
    return agentsStep(reader, taskChange(chat.agents, m as TaskMessage, now))
  }
  if (m.subtype === 'background_tasks_changed') {
    // Lista completa a cada mudança. Subagentes já vêm pelos task_*; ambientes não são trabalho.
    const count = (m.tasks as Line[]).filter((t) => !t.ambient && t.task_type !== 'local_agent').length
    return count === chat.backgroundTasks ? { reader } : { reader, patch: { backgroundTasks: count }, urgent: true }
  }
  // A compactação é gravada no arquivo da sessão: o chat relê e mostra o divisor.
  if (m.subtype === 'compact_boundary') return { reader, patch: { revision: chat.revision + 1 }, urgent: true }
  return { reader }
}

function readStream(e: StreamEvent, chat: ChatState, reader: Reader, ctx: ReadContext): Step {
  if (e.type === 'message_start') return startMessage(chat, reader, ctx)
  if (e.type === 'content_block_start') return startBlock(e.content_block as Line, chat, reader, ctx.now)
  if (e.type === 'content_block_delta' && e.delta.type === 'input_json_delta') return toolInput(e.delta.partial_json, chat, reader)
  if (e.type === 'content_block_stop') {
    // Pedido da ferramenta pronto: daqui ela roda.
    const ran = reader.block === 'tool_use'
    const patch = ran ? { activity: { ...chat.activity!, kind: 'running' as const, since: ctx.now } } : undefined
    return { reader: { ...reader, block: '' }, patch, urgent: ran }
  }
  if (e.type === 'content_block_delta' && e.delta.type === 'text_delta') {
    return { reader, patch: { partial: chat.partial + e.delta.text } }
  }
  if (e.type === 'message_delta' && typeof e.usage?.output_tokens === 'number') {
    const next = { ...reader, currentTokens: e.usage.output_tokens }
    return { reader: next, patch: { turnTokens: next.closedTokens + next.currentTokens } }
  }
  return { reader }
}

// A prévia só é trocada quando começa outra resposta: até lá o chat já releu o histórico.
function startMessage(chat: ChatState, reader: Reader, ctx: ReadContext): Step {
  // Pedido que o app não viu começar (veio pelo remote control, ou é a mensagem que esperava na
  // fila do Claude): começa a contagem de tempo e tokens aqui.
  const fresh = !chat.turnStartedAt
  const patch: Partial<ChatState> = fresh
    ? { status: ctx.waiting ? 'needs-you' : 'running', turnStartedAt: ctx.now, turnTokens: 0 }
    : {}
  patch.partial = ''
  patch.activity = activity(chat.activity, 'thinking', ctx.now)
  const closedTokens = fresh ? 0 : reader.closedTokens + reader.currentTokens
  return { reader: { ...reader, closedTokens, currentTokens: 0 }, patch, turnStarted: fresh }
}

function startBlock(b: Line | undefined, chat: ChatState, reader: Reader, now: number): Step {
  const next = { ...reader, block: b?.type ?? '' }
  if (b?.type === 'thinking' || b?.type === 'redacted_thinking') {
    return { reader: next, patch: { activity: activity(chat.activity, 'thinking', now) }, urgent: true }
  }
  if (b?.type === 'text') return { reader: next, patch: { activity: activity(chat.activity, 'writing', now) }, urgent: true }
  if (b?.type === 'tool_use') {
    const preparing: ChatActivity = { kind: 'preparing', tool: describeTool(b.name, {}).label, since: now }
    return { reader: { ...next, toolName: b.name, toolInput: '' }, patch: { activity: preparing }, urgent: true }
  }
  return { reader: next }
}

// O pedido da ferramenta chegando aos pedaços: o resumo (arquivo, comando...) aparece assim que fecha.
function toolInput(chunk: string, chat: ChatState, reader: Reader): Step {
  if (reader.toolInput.length > TOOL_INPUT_SCAN) return { reader }
  const next = { ...reader, toolInput: reader.toolInput + chunk }
  const input = closedFields(next.toolInput)
  if (!Object.keys(input).length) return { reader: next }
  const summary = describeTool(reader.toolName, input).summary
  if (!summary || summary === chat.activity?.summary) return { reader: next }
  return { reader: next, patch: { activity: { ...chat.activity!, summary } } }
}

function readTranscript(m: Transcript, chat: ChatState, reader: Reader, now: number): Step {
  if (m.parent_tool_use_id) {
    // Por dentro de um subagente: não mexe no histórico da conversa.
    if (m.type !== 'assistant') return { reader }
    return agentsStep(reader, subagentSteps(chat.agents, m.parent_tool_use_id, m.message.content))
  }
  const patch: Partial<ChatState> = {}
  // Resultado da chamada que lançou o subagente: em primeiro plano, ele terminou.
  if (m.type === 'user' && Array.isArray(m.message.content)) {
    const done = new Set(
      (m.message.content as Line[]).filter((c) => c?.type === 'tool_result').map((c) => c.tool_use_id as string)
    )
    const change = finishedAgents(chat.agents, done)
    if (change) patch.agents = change.agents
    // Resultado entregue: o Claude volta a pensar no próximo passo.
    if (done.size) patch.activity = activity(chat.activity, 'thinking', now)
  }
  // Já gravado no arquivo: o chat relê o histórico.
  patch.revision = chat.revision + 1
  return { reader, patch, urgent: true }
}

function readResult(m: Result, chat: ChatState, reader: Reader, ctx: ReadContext): Step {
  // Parada a seu pedido não vira mensagem de erro.
  const failed = (m.subtype !== 'success' || m.is_error) && !ctx.interrupted
  return {
    reader,
    turnEnded: true,
    contextWindows: Object.entries(m.modelUsage ?? {}).map(([model, u]) => [model, u.contextWindow]),
    urgent: true,
    patch: {
      // Pedido encerrado: só os de segundo plano continuam.
      agents: chat.agents.filter((a) => a.background),
      status: ctx.waiting ? 'needs-you' : ctx.resumes ? 'running' : 'idle',
      turnStartedAt: undefined,
      activity: undefined,
      // A prévia fica: a tela tira quando o histórico relido trouxer o mesmo texto (ver ChatSession).
      revision: chat.revision + 1,
      error: failed ? ('result' in m && m.result ? m.result : 'O Claude parou com erro.') : undefined
    }
  }
}
