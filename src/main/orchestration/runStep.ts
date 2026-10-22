import { query, type CanUseTool } from '@anthropic-ai/claude-agent-sdk'
import type { RunningAgent } from '../../shared/agents'
import type { ChatSettings } from '../../shared/chat'
import { STEP_PROVIDER_NAMES, type StepAgent } from '../../shared/orchestrator'
import { accountIds, defaultAccount } from '../accounts'
import { AcpDriver } from '../agentChats/acp'
import { CodexDriver } from '../agentChats/codex'
import type { Driver, DriverEvents } from '../agentChats/driver'
import { sanitizeSettings } from '../agentChats/models'
import { claudeCodeOptions } from '../chats/env'
import { toPermissionMode } from '../chats/settings'
import { diffFromInput } from '../diffs'
import { tr } from '../i18n'
import { expandHome } from '../paths'
import { resolveEntry } from '../providers/registry'
import { describeTool } from '../toolLabels'
import type { DelegateArgs, StepHost } from './types'

// Roda uma etapa delegada num agente, do começo ao fim, sem conversa na tela: o Claude pelo SDK, os
// outros pelos mesmos drivers do chat (agentChats/). A etapa herda a pasta e o modo de permissão do
// orquestrador; o que ela perguntar aparece no chat dele. Ela não recebe a ferramenta delegate (não
// delega de novo).

export type StepRun = {
  text: string
  error?: string
  tokens?: number
  // Conta e modelo que valeram de fato (modelo pedido que a conta não tem vira o padrão dela).
  account: string
  model: string
  effort: string
  notice?: string
}

type Progress = (patch: Partial<RunningAgent>) => void

const STEPS_MAX = 40
const EDIT_TOOLS = ['Edit', 'Write', 'MultiEdit', 'NotebookEdit']
// Etapa sem nenhum sinal do agente nesse tempo: travou (o Gemini sem cota fica tentando de novo em
// silêncio, por exemplo). O vigia cancela só a etapa e o orquestrador refaz em outro agente. Quanto
// mais esforço, mais tempo o modelo pode pensar sem mostrar nada (o Codex em esforço alto manda só o
// resumo do raciocínio). Sem esforço escolhido, o do meio.
function silenceMinutes(effort?: string): number {
  if (effort === 'low' || effort === 'medium') return 5
  if (effort === 'xhigh' || effort === 'max') return 15
  return 10
}

// Etapa só de leitura: o modo de planejamento do agente (sem editar). Senão, o do orquestrador.
const modeFor = (host: StepHost, readOnly?: boolean) => (readOnly ? 'plan' : host.permissionMode())

export async function runStep(agent: StepAgent, args: DelegateArgs, host: StepHost, signal: AbortSignal, progress: Progress): Promise<StepRun> {
  const minutes = silenceMinutes(args.effort)
  const silence = new SilenceWatch(minutes * 60_000)
  // Para quando a pessoa (ou o orquestrador) desiste, ou quando o vigia vê a etapa muda.
  const stop = AbortSignal.any([signal, silence.signal])
  try {
    return await (agent.provider === 'claude' ? runClaude(agent, args, host, stop, progress, silence) : runDriver(agent, args, host, stop, progress, silence))
  } catch (err) {
    if (!silence.fired) throw err
    const name = STEP_PROVIDER_NAMES[agent.provider]
    throw new Error(
      tr(
        `${name} ficou ${minutes} min sem dar sinal e a etapa foi cancelada. Refaça em outro agente.`,
        `${name} gave no sign of life for ${minutes} min and the step was cancelled. Redo it with another agent.`
      )
    )
  } finally {
    silence.stop()
  }
}

// Vigia de silêncio da etapa. Qualquer mensagem do agente reinicia a conta; ela pausa com uma
// ferramenta rodando (um comando longo pode ficar minutos sem saída) e com uma pergunta esperando
// a sua resposta.
class SilenceWatch {
  private controller = new AbortController()
  private timer: NodeJS.Timeout | undefined
  private running = new Set<string>()
  private waiting = 0
  fired = false

  constructor(private ms: number) {
    this.arm()
  }

  get signal(): AbortSignal {
    return this.controller.signal
  }

  alive(): void {
    this.arm()
  }

  tool(id: string, done: boolean): void {
    if (done) this.running.delete(id)
    else this.running.add(id)
    this.arm()
  }

  // Pergunta esperando você: não conta como silêncio do agente.
  async waitFor<T>(answer: Promise<T>): Promise<T> {
    this.waiting++
    this.arm()
    try {
      return await answer
    } finally {
      this.waiting--
      this.arm()
    }
  }

  stop(): void {
    clearTimeout(this.timer)
    this.timer = undefined
  }

  private arm(): void {
    this.stop()
    if (this.fired || this.running.size || this.waiting) return
    this.timer = setTimeout(() => {
      this.fired = true
      this.controller.abort()
    }, this.ms)
  }
}

// O agente que travou de vez nem responde ao pedido de parar: a etapa desiste na hora e o processo
// é fechado (no finally de quem chama), em vez de esperar para sempre.
function untilStopped<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new Error(tr('Etapa cancelada.', 'Step cancelled.')))
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new Error(tr('Etapa cancelada.', 'Step cancelled.')))
    signal.addEventListener('abort', onAbort, { once: true })
    work.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort))
  })
}

// Ferramentas usadas pela etapa, para a linha dela no chat.
function stepTracker(progress: Progress) {
  const seen = new Set<string>()
  const steps: RunningAgent['steps'] = []
  return (id: string, label: string, summary: string) => {
    if (seen.has(id)) return
    seen.add(id)
    steps.push({ label, summary })
    progress({ steps: steps.slice(-STEPS_MAX), toolUses: seen.size, summary: summary ? `${label} - ${summary}` : label })
  }
}

async function runDriver(agent: StepAgent, args: DelegateArgs, host: StepHost, signal: AbortSignal, progress: Progress, silence: SilenceWatch): Promise<StepRun> {
  const provider = agent.provider as Exclude<StepAgent['provider'], 'claude'>
  const entry = resolveEntry(provider, agent.account)
  if (!entry) throw new Error(tr(`Nenhuma conta do ${provider} conectada ao Argus.`, `No ${provider} account connected to Argus.`))
  const ref = { provider, account: entry.id }
  const wanted: ChatSettings = { model: args.model ?? '', effort: args.effort ?? '', thinking: false, ultracode: false, permissionMode: modeFor(host, args.readOnly) }
  const settings = await sanitizeSettings(ref, wanted)
  const notice = wanted.model && !settings.model ? tr(`O modelo ${wanted.model} não existe nesta conta; usei o padrão.`, `Model ${wanted.model} isn't available on this account; used the default.`) : undefined

  const segments: string[] = []
  let current = ''
  let tokens = 0
  let exitReason: string | undefined
  const track = stepTracker(progress)
  const closeText = () => {
    if (current.trim()) segments.push(current.trim())
    current = ''
  }
  const events: DriverEvents = {
    text: (d) => (current += d),
    textDone: closeText,
    thought: () => {},
    thoughtDone: () => {},
    tool: (t) => {
      silence.tool(t.id, t.done)
      track(t.id, t.label, t.input)
    },
    permission: (ask) => silence.waitFor(host.permission(ask)),
    title: () => {},
    usage: (u) => (tokens += u.turnTokens ?? 0),
    exited: (reason) => (exitReason = reason),
    activity: () => silence.alive()
  }
  const cwd = expandHome(host.cwd)
  const driver: Driver = provider === 'codex' ? new CodexDriver(entry.id, cwd, settings, events, host.folders) : new AcpDriver(provider, entry.id, cwd, settings, events, host.folders)
  const stop = () => void driver.cancel()
  signal.addEventListener('abort', stop)
  try {
    await untilStopped(driver.start(), signal)
    await untilStopped(driver.prompt({ text: taskText(args), images: [] }), signal)
    closeText()
    const text = segments.at(-1) ?? ''
    if (!text && exitReason) throw new Error(exitReason)
    return { text, tokens: tokens || undefined, account: `${provider}:${entry.id}`, model: settings.model, effort: settings.effort, notice }
  } finally {
    signal.removeEventListener('abort', stop)
    driver.close()
  }
}

async function runClaude(agent: StepAgent, args: DelegateArgs, host: StepHost, signal: AbortSignal, progress: Progress, silence: SilenceWatch): Promise<StepRun> {
  const account = agent.account && accountIds().includes(agent.account) ? agent.account : defaultAccount()
  const abort = new AbortController()
  const stop = () => abort.abort()
  signal.addEventListener('abort', stop)
  const track = stepTracker(progress)
  const canUseTool: CanUseTool = async (toolName, input) => {
    // Etapa não tem como perguntar à pessoa nem sair do planejamento: decide e entrega.
    if (toolName === 'AskUserQuestion')
      return { behavior: 'deny', message: 'Etapa delegada: não há como perguntar à pessoa. Decida e diga no resultado o que assumiu.' }
    if (toolName === 'ExitPlanMode') return { behavior: 'deny', message: 'Etapa só de leitura: entregue o plano como resposta.' }
    const d = describeTool(toolName, input)
    const reply = await silence.waitFor(host.permission({ toolName, label: d.label, summary: d.summary, detail: d.detail, diff: diffFromInput(toolName, input), canAlwaysAllow: false }))
    return reply === 'deny' ? { behavior: 'deny', message: 'A pessoa negou esta ação.' } : { behavior: 'allow', updatedInput: input }
  }
  const q = query({
    prompt: taskText(args),
    options: {
      ...claudeCodeOptions(host.cwd, account, host.folders),
      model: args.model || undefined,
      effort: (args.effort || undefined) as never,
      permissionMode: toPermissionMode(modeFor(host, args.readOnly)),
      allowDangerouslySkipPermissions: true,
      abortController: abort,
      canUseTool,
      // A resposta aos pedaços: sinal de vida para o vigia enquanto o modelo pensa ou escreve.
      includePartialMessages: true,
      ...(args.readOnly && { disallowedTools: EDIT_TOOLS })
    }
  })
  let last = ''
  let result: string | undefined
  let error: string | undefined
  let tokens: number | undefined
  try {
    for await (const m of q) {
      silence.alive()
      // Resultado de ferramenta: ela terminou (o vigia volta a contar).
      if (m.type === 'user' && Array.isArray(m.message.content))
        for (const c of m.message.content) if (c.type === 'tool_result') silence.tool(c.tool_use_id, true)
      if (m.type === 'assistant' && !m.parent_tool_use_id) {
        const texts: string[] = []
        for (const c of m.message.content) {
          if (c.type === 'text' && c.text.trim()) texts.push(c.text.trim())
          if (c.type === 'tool_use') {
            silence.tool(c.id, false)
            const d = describeTool(c.name, c.input as Record<string, unknown>)
            track(c.id, d.label, d.summary)
          }
        }
        if (texts.length) last = texts.join('\n\n')
      }
      if (m.type === 'result') {
        tokens = m.usage?.output_tokens
        if (m.subtype === 'success' && !m.is_error) result = m.result
        else error = m.subtype === 'success' ? m.result : m.errors?.join('\n') || m.subtype
      }
    }
  } catch (err) {
    if (signal.aborted) throw new Error(tr('Etapa cancelada.', 'Step cancelled.'))
    throw err
  } finally {
    signal.removeEventListener('abort', stop)
    q.close()
  }
  if (error) throw new Error(error)
  return { text: (result ?? last).trim(), tokens, account: `claude:${account}`, model: args.model ?? '', effort: args.effort ?? '' }
}

// O pedido como a etapa recebe: a tarefa, mais o lembrete do que a etapa é.
function taskText(args: DelegateArgs): string {
  const notes = [
    'Esta é uma etapa delegada por outro agente (o orquestrador), que lê só a sua resposta final. Entregue nela o resultado completo, sem pedir confirmação: não há ninguém para responder perguntas.',
    args.readOnly ? 'Etapa só de leitura: não altere arquivos.' : ''
  ].filter(Boolean)
  return `${args.task}\n\n<etapa-delegada>\n${notes.join('\n')}\n</etapa-delegada>`
}
