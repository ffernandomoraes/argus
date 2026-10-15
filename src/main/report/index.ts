import { homedir } from 'node:os'
import { app } from 'electron'
import { createSdkMcpServer, query, type CanUseTool, type Query } from '@anthropic-ai/claude-agent-sdk'
import { MAIN_ACCOUNT } from '../../shared/auth'
import { parseAgentRef } from '../../shared/providers'
import type { ReportProblem, ReportState } from '../../shared/report'
import { claudeProcess, Inbox } from '../chats'
import { tr } from '../i18n'
import { errorMessage } from '../lib/errors'
import { describeTool } from '../toolLabels'
import { collectContext, type ContextSources } from './context'
import { systemPrompt } from './prompt'
import { scrub, SECRET_FILE } from './scrub'
import { sourceFor } from './source'
import { reportTools } from './tools'

export { captureAppLog } from './appLog'

// Reportar problema: junta o que o app sabe da máquina, pede ao Claude da própria pessoa que
// investigue (só lendo, com as ferramentas de tools.ts, que incluem o código do Argus na versão
// instalada) e monta um texto para ela copiar e mandar ao desenvolvedor. Sem conta logada, ou se o Claude falhar, o texto vai só com os dados do app:
// muitas vezes o problema é justamente o Claude não funcionar. Um relatório por vez, o mesmo em
// todas as janelas.

const TIME_LIMIT_MS = 10 * 60_000
const MAX_TURNS = 60
const STEPS_MAX = 60
// Os dados vão inteiros para o Claude; no texto para copiar, o começo e o fim (os avisos mais
// recentes ficam no fim).
const APPENDIX_HEAD = 20_000
const APPENDIX_TAIL = 10_000

type Run = { q: Query | null; stopped: 'user' | 'time' | null; timer: NodeJS.Timeout | null }

const allow = (input: Record<string, unknown>) => ({ behavior: 'allow' as const, updatedInput: input })

// Só as ferramentas do app e a leitura de arquivos que não guardam login ou chave.
const readOnly: CanUseTool = async (name, input) => {
  if (name.startsWith('mcp__argus__')) return allow(input)
  if (name === 'Read' || name === 'Glob') {
    const target = [input.file_path, input.path, input.pattern].filter((v) => typeof v === 'string').join(' ')
    if (SECRET_FILE.test(target)) return { behavior: 'deny', message: 'Arquivo de login ou chave: o Argus não deixa ler. Para saber do login, use status_login.' }
    return allow(input)
  }
  return { behavior: 'deny', message: 'Nesta investigação só dá para ler.' }
}

// O passo como aparece na tela enquanto investiga.
function stepLabel(name: string, input: Record<string, unknown>): string {
  const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined)
  switch (name) {
    case 'mcp__argus__diagnostico_app':
      return tr('Conferindo os dados do app', 'Checking app data')
    case 'mcp__argus__status_login': {
      const where = str(input.distro) ?? str(input.pasta)
      const who = str(input.conta) ?? tr('conta padrão', 'default account')
      return tr(`Conferindo o login (${who}${where ? `, ${where}` : ''})`, `Checking sign-in (${who}${where ? `, ${where}` : ''})`)
    }
    case 'mcp__argus__conferir_wsl':
      return tr(`Conferindo o WSL (${str(input.distro) ?? ''})`, `Checking WSL (${str(input.distro) ?? ''})`)
    case 'mcp__argus__codigo_arquivos':
      return tr('Olhando os arquivos do código do Argus', 'Browsing the Argus source files')
    case 'mcp__argus__codigo_ler':
      return tr(`Lendo o código: ${str(input.caminho) ?? ''}`, `Reading the code: ${str(input.caminho) ?? ''}`)
    case 'mcp__argus__codigo_buscar':
      return tr(`Procurando no código: “${str(input.texto) ?? ''}”`, `Searching the code: “${str(input.texto) ?? ''}”`)
  }
  const d = describeTool(name, input)
  return d.summary ? `${d.label}: ${d.summary}` : d.label
}

type ResultLike = { subtype: string; is_error?: boolean; result?: string; errors?: string[] }

function resultText(m: ResultLike): string {
  if (m.subtype === 'success' && !m.is_error) return m.result ?? ''
  throw new Error(m.result || m.errors?.join('; ') || m.subtype)
}

function appendix(context: string): string {
  if (context.length <= APPENDIX_HEAD + APPENDIX_TAIL) return context
  return `${context.slice(0, APPENDIX_HEAD)}\n\n(... cortado ...)\n\n${context.slice(-APPENDIX_TAIL)}`
}

// O texto para copiar. Em português: quem lê é o desenvolvedor.
function compose(problem: ReportProblem, analysis: string, note: string | undefined, context: string, account: string | null): string {
  const reported = [problem.description.trim() || '(sem descrição)']
  if (problem.error) reported.push('', `Erro na tela: ${problem.error}`)
  const lines = [
    '# Relatório de problema do Argus',
    '',
    analysis ? `Investigado pelo Claude da conta ${account}, com o código do Argus ${app.getVersion()}.` : `Sem a análise do Claude: ${note ?? 'não rodou'}`,
    '',
    '## O que a pessoa relatou',
    ...reported,
    '',
    ...(analysis ? [analysis.trim(), ''] : []),
    '## Dados coletados pelo app',
    '```text',
    appendix(context),
    '```'
  ]
  return scrub(lines.join('\n'))
}

export class ProblemReport {
  state: ReportState = { status: 'idle' }
  private run: Run | null = null

  constructor(
    private sources: ContextSources,
    private onState: (state: ReportState) => void
  ) {}

  private set(state: ReportState): void {
    this.state = state
    this.onState(state)
  }

  private step(run: Run, label: string): void {
    if (this.run !== run || this.state.status !== 'running') return
    this.set({ ...this.state, steps: [...this.state.steps, label].slice(-STEPS_MAX) })
  }

  start(problem: ReportProblem): void {
    if (this.state.status === 'running') return
    const run: Run = { q: null, stopped: null, timer: null }
    run.timer = setTimeout(() => this.halt(run, 'time'), TIME_LIMIT_MS)
    this.run = run
    this.set({ status: 'running', startedAt: Date.now(), steps: [tr('Juntando os dados do app', 'Collecting app data')] })
    void this.investigate(run, problem)
  }

  // Parar: o relatório sai com os dados do app, sem a análise.
  stop(): void {
    if (this.run) this.halt(this.run, 'user')
  }

  // Volta ao formulário (nova investigação). Com uma rodando, nada muda.
  reset(): void {
    if (this.state.status !== 'running') this.set({ status: 'idle' })
  }

  private halt(run: Run, why: 'user' | 'time'): void {
    if (run.stopped) return
    run.stopped = why
    run.q?.close()
  }

  // A conta do grupo onde o erro apareceu, se tem login; senão a padrão, a principal ou qualquer
  // uma logada. Agente de outro provedor (Codex, Gemini, Cursor) não investiga: vale a padrão.
  private pickAccount(problem: ReportProblem): string | null {
    const auth = this.sources.auth()
    const logged = (id: string) => auth.accounts.some((a) => a.id === id && a.status?.loggedIn)
    const wanted = problem.account && !parseAgentRef(problem.account) ? problem.account : undefined
    const order = [wanted, auth.defaultId, MAIN_ACCOUNT, ...auth.accounts.map((a) => a.id)]
    return order.find((id): id is string => !!id && logged(id)) ?? null
  }

  private async investigate(run: Run, problem: ReportProblem): Promise<void> {
    let context: string
    try {
      context = await collectContext(this.sources, problem)
    } catch (err) {
      context = `Não deu para juntar os dados do app: ${errorMessage(err)}`
    }
    const account = run.stopped ? null : this.pickAccount(problem)
    let analysis = ''
    let failure: string | undefined
    if (account) {
      try {
        analysis = await this.ask(run, account, context)
      } catch (err) {
        failure = errorMessage(err)
      }
    }
    if (this.run !== run) return
    this.run = null
    if (run.timer) clearTimeout(run.timer)
    const note =
      run.stopped === 'user'
        ? tr('a investigação foi parada antes do fim.', 'the investigation was stopped before the end.')
        : run.stopped === 'time'
          ? tr('a investigação passou do tempo e foi parada.', 'the investigation ran out of time and was stopped.')
          : !account
            ? tr('nenhuma conta do Claude com login neste app.', 'no Claude account is signed in on this app.')
            : failure
              ? tr(`o Claude falhou (${failure}).`, `Claude failed (${failure}).`)
              : !analysis
                ? tr('o Claude terminou sem relatório.', 'Claude finished without a report.')
                : undefined
    const done = run.stopped ? '' : analysis
    this.set({ status: 'done', analyzed: !!done, note: done ? undefined : note, text: compose(problem, done, note, context, account) })
  }

  private async ask(run: Run, account: string, context: string): Promise<string> {
    const inbox = new Inbox()
    // O código da versão instalada já começa a baixar: quando o Claude pedir, ele está pronto. O
    // catch só evita o aviso de rejeição sem tratamento; a ferramenta recebe o erro.
    const version = app.getVersion()
    sourceFor(version).catch(() => {})
    const tools = reportTools(() => collectContext(this.sources), () => sourceFor(version))
    const server = createSdkMcpServer({ name: 'argus', tools, alwaysLoad: true })
    const q = query({
      prompt: inbox,
      options: {
        cwd: homedir(),
        ...claudeProcess(account),
        systemPrompt: systemPrompt(),
        // Ler arquivos e listar nomes; o resto da máquina, só pelas ferramentas do app. Sem as
        // configurações, hooks e MCPs da pessoa.
        tools: ['Read', 'Glob'],
        settingSources: [],
        strictMcpConfig: true,
        mcpServers: { argus: server },
        canUseTool: readOnly,
        persistSession: false,
        maxTurns: MAX_TURNS
      }
    })
    run.q = q
    if (run.stopped) q.close()
    inbox.push({
      type: 'user',
      message: { role: 'user', content: `Investigue o problema abaixo. São os dados que o app já juntou; diagnostico_app traz de novo.\n\n${context}` },
      parent_tool_use_id: null
    })
    try {
      for await (const m of q) {
        if (m.type === 'assistant') {
          for (const block of m.message.content) {
            if (block.type === 'tool_use') this.step(run, stepLabel(block.name, (block.input ?? {}) as Record<string, unknown>))
          }
        }
        if (m.type === 'result') return resultText(m as ResultLike)
      }
      return ''
    } finally {
      inbox.close()
      q.close()
    }
  }
}
