import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { ClaudeModel } from '../../shared/models'
import {
  DELEGATE_TOOL,
  LIST_AGENTS_TOOL,
  REPORT_VALIDATION_TOOL,
  STEP_PROVIDER_NAMES,
  parseStepAgent,
  stepAgentId,
  stepLabel
} from '../../shared/orchestrator'
import { PROVIDERS } from '../../shared/providers'
import { accountIds, customName, defaultAccount } from '../accounts'
import { agentInfo } from '../agentChats/models'
import { tr } from '../i18n'
import { errorMessage } from '../lib/errors'
import { customName as providerName, defaultEntry, entries } from '../providers/registry'
import { runStep } from './runStep'
import { claudeInfoOf } from './state'
import { recordStep } from './stepLog'
import type { DelegateArgs, StepHost } from './types'

// As ferramentas do orquestrador, iguais para todo agente: o Claude recebe pelo servidor dentro do
// SDK (terminals/drawerShells.ts), os outros pelo servidor HTTP local (mcpServer.ts).

export const delegateShape = {
  agent: z
    .string()
    .min(1)
    .describe('Quem executa: claude, codex, gemini ou cursor, com a conta depois de ":" quando houver mais de uma (ex.: codex:main). Veja list_agents.'),
  model: z.string().optional().describe('Modelo, como list_agents mostra. Vazio: o padrão da conta.'),
  effort: z.string().optional().describe('Esforço (low, medium, high, xhigh, max), quando o modelo tem.'),
  task: z
    .string()
    .min(1)
    .describe('O pedido completo. Quem recebe não vê esta conversa: inclua arquivos, decisões, restrições e o que entregar.'),
  title: z.string().optional().describe('Resumo curto da etapa (até 8 palavras), para a pessoa ver no chat.'),
  rule: z.string().optional().describe('Texto da regra do orquestrador usada para escolher agente e modelo, se houver.'),
  readOnly: z.boolean().optional().describe('true se a etapa só lê. Pode rodar em paralelo; as que alteram arquivos rodam uma de cada vez.'),
  validates: z.string().optional().describe('Id da etapa que esta valida (vem no resultado dela).')
}

export const reportShape = {
  step: z.string().min(1).describe('Id da etapa validada.'),
  passed: z.boolean().describe('true se a validação aprovou a etapa.'),
  note: z.string().optional().describe('O problema achado, em uma frase, quando reprovou.')
}

export const TOOL_DESCRIPTIONS = {
  [DELEGATE_TOOL]:
    'Modo orquestrador do Argus: roda uma etapa em outro agente (Claude, Codex, Gemini ou Cursor), na mesma pasta desta conversa, e devolve o que ele entregou. Use só quando as instruções <orquestrador> pedirem. A etapa herda o modo de permissão desta conversa; perguntas dela aparecem para a pessoa aqui.',
  [LIST_AGENTS_TOOL]: 'Modo orquestrador do Argus: lista os agentes conectados, as contas e os modelos de cada um, para escolher quem executa cada etapa.',
  [REPORT_VALIDATION_TOOL]: 'Modo orquestrador do Argus: registra o veredito da validação de uma etapa (aprovada ou não). Chame depois de ler o resultado de uma etapa de validação.'
}

export type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean }

const reply = (text: string, isError = false): ToolResult => ({ content: [{ type: 'text', text }], ...(isError && { isError }) })

export async function callTool(name: string, args: Record<string, unknown>, host: StepHost, transport: AbortSignal, metaCallId?: string): Promise<ToolResult> {
  // Para quando o agente desiste da chamada ou quando a pessoa para o pedido.
  const signal = AbortSignal.any([transport, host.stopSignal()])
  try {
    if (name === DELEGATE_TOOL) return await delegate(z.object(delegateShape).parse(args), host, signal, metaCallId)
    if (name === LIST_AGENTS_TOOL) return reply(await listAgents())
    if (name === REPORT_VALIDATION_TOOL) {
      const r = z.object(reportShape).parse(args)
      await recordStep({ type: 'verdict', at: new Date().toISOString(), step: r.step, passed: r.passed, note: r.note, orchestrator: host.orchestrator })
      return reply('Registrado.')
    }
    return reply(`Ferramenta desconhecida: ${name}`, true)
  } catch (err) {
    return reply(errorMessage(err), true)
  }
}

// Etapas que alteram arquivos, uma de cada vez por conversa: cada uma espera a anterior.
const writes = new WeakMap<StepHost, Promise<void>>()

async function writeTurn(host: StepHost, signal: AbortSignal): Promise<() => void> {
  const before = writes.get(host) ?? Promise.resolve()
  let release!: () => void
  const mine = new Promise<void>((r) => (release = r))
  writes.set(host, before.then(() => mine))
  // Parada no meio da espera: desiste sem esperar a anterior.
  await Promise.race([before, new Promise<void>((r) => signal.addEventListener('abort', () => r(), { once: true }))])
  if (signal.aborted) {
    release()
    throw new Error(tr('Etapa cancelada.', 'Step cancelled.'))
  }
  return release
}

const firstLine = (s: string) => s.trim().split('\n')[0].slice(0, 80)

async function delegate(args: DelegateArgs, host: StepHost, signal: AbortSignal, metaCallId?: string): Promise<ToolResult> {
  const agent = parseStepAgent(args.agent)
  if (!agent) return reply(`Agente desconhecido: "${args.agent}". Use ${LIST_AGENTS_TOOL} para ver os disponíveis.`, true)
  const id = randomUUID().replace(/-/g, '').slice(0, 8)
  const startedAt = Date.now()
  const label = stepLabel(args.agent, args.model)
  // A pergunta da etapa diz quem pergunta: "Codex - gpt-5.5 - Comando".
  const stepHost: StepHost = { ...host, permission: (ask) => host.permission({ ...ask, label: `${label} - ${ask.label}` }) }
  host.started({
    id,
    toolUseId: host.callIdFor(args, metaCallId),
    agent: label,
    description: args.title || firstLine(args.task),
    startedAt,
    toolUses: 0,
    steps: [],
    background: false,
    ...(!args.readOnly && { summary: tr('Esperando a etapa anterior terminar', 'Waiting for the previous step to finish') })
  })
  let release = () => {}
  let result = ''
  let failed: string | undefined
  let run: Awaited<ReturnType<typeof runStep>> | undefined
  try {
    if (!args.readOnly) release = await writeTurn(host, signal)
    host.progressed(id, { summary: tr('Começando…', 'Starting…') })
    run = await runStep(agent, args, stepHost, signal, (patch) => host.progressed(id, patch))
    result = run.text || tr('(a etapa terminou sem resposta em texto)', '(the step finished without a text answer)')
  } catch (err) {
    failed = errorMessage(err)
  } finally {
    release()
  }
  const durationMs = Date.now() - startedAt
  host.finished(id, failed ?? result, !!failed)
  void recordStep({
    type: 'step',
    id,
    at: new Date(startedAt).toISOString(),
    orchestrator: host.orchestrator,
    agent: run?.account ?? stepAgentId(agent),
    model: run?.model ?? args.model ?? '',
    effort: run?.effort ?? args.effort ?? '',
    rule: args.rule,
    title: args.title,
    readOnly: !!args.readOnly,
    validates: args.validates,
    outcome: failed ? (signal.aborted ? 'cancelled' : 'error') : 'ok',
    error: failed,
    durationMs,
    tokens: run?.tokens,
    cwd: host.cwd
  })
  const minutes = Math.max(1, Math.round(durationMs / 60_000))
  const header = `[etapa ${id} - ${stepLabel(run?.account ?? args.agent, run?.model || args.model)} - ${failed ? 'falhou' : 'concluída'} em ${minutes} min]`
  const notice = run?.notice ? `\n${run.notice}` : ''
  return failed ? reply(`${header}\n${failed}`, true) : reply(`${header}${notice}\n\n${result}`)
}

const modelLine = (m: ClaudeModel) => {
  const name = m.value || `padrão${m.resolvedName ? ` (${m.resolvedName})` : ''}`
  return m.efforts.length ? `${name} [esforços: ${m.efforts.join(', ')}]` : name
}

// Agentes, contas e modelos que o Argus tem agora. Os modelos dos outros agentes vêm do próprio CLI
// (pode levar alguns segundos na primeira vez; depois fica guardado).
async function listAgents(): Promise<string> {
  const lines: string[] = ['Agentes disponíveis (passe o id em agent; o modelo em model):']
  const claudeDefault = defaultAccount()
  for (const id of accountIds()) {
    const info = claudeInfoOf(id)
    const name = customName(id) ?? (id === 'main' ? 'conta principal' : id)
    const models = info?.models.filter((m) => m.value).map(modelLine).join('; ') || 'opus, sonnet, haiku, fable'
    lines.push(`- claude:${id} (Claude - ${name}${id === claudeDefault ? ', padrão' : ''}): ${models}`)
  }
  const others = PROVIDERS.flatMap((provider) => entries(provider).map((e) => ({ provider, id: e.id })))
  const infos = await Promise.all(others.map((o) => agentInfo({ provider: o.provider, account: o.id }).catch(() => null)))
  others.forEach((o, i) => {
    const info = infos[i]
    const name = providerName(o.provider, o.id) ?? (o.id === 'main' ? 'conta principal' : o.id)
    const models = info ? info.models.map(modelLine).join('; ') : 'não consegui listar (use o padrão)'
    const isDefault = defaultEntry(o.provider) === o.id
    lines.push(`- ${o.provider}:${o.id} (${STEP_PROVIDER_NAMES[o.provider]} - ${name}${isDefault ? ', padrão' : ''}): ${models}`)
  })
  if (!others.length) lines.push('(Nenhum outro agente conectado: só o Claude. A pessoa conecta Codex, Gemini e Cursor em Configurações > Contas.)')
  return lines.join('\n')
}
