import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { app } from 'electron'
import type { ClaudeBinary, ClaudeVersionState } from '../../shared/claudeVersion'
import { claudeEnv } from '../chats/env'
import { runClaudeInstaller } from '../claudeInstall'
import { allClaudes, chooseClaude, claudeCommand, claudePath, lookupClaude } from '../claudePath'
import { tr } from '../i18n'
import { isNewer } from '../updater/releases'

// A lista de modelos vem do `claude` que o app usa: um Claude Code antigo não mostra os modelos
// novos (o Opus 5.5, por exemplo). Aqui o app pergunta a versão de cada `claude` da máquina, usa o
// mais novo (o da extensão do VS Code conta) e compara com a publicada no npm, para avisar e
// atualizar com `claude update`.

const run = promisify(execFile)
const EVERY_MS = 5 * 60 * 60_000
const LATEST_URL = 'https://registry.npmjs.org/@anthropic-ai/claude-code/latest'
// Baixar a versão nova leva de segundos a alguns minutos, conforme a internet.
const UPDATE_TIMEOUT_MS = 10 * 60_000

// "2.1.296 (Claude Code)" → "2.1.296".
// Só em desenvolvimento: finge que o `claude` em uso tem esta versão, para ver o aviso e o botão
// Atualizar sem ter um Claude Code antigo. Ex.: ARGUS_FAKE_CLAUDE_VERSION=2.0.0 pnpm dev
const FAKE_VERSION = app.isPackaged ? null : (process.env.ARGUS_FAKE_CLAUDE_VERSION ?? null)

const parseVersion = (text: string): string | null => /(\d+\.\d+\.\d+)/.exec(text)?.[1] ?? null

async function versionOf(path: string): Promise<string | null> {
  try {
    const { file, args } = claudeCommand(['--version'], path)
    const { stdout } = await run(file, args, { env: claudeEnv(path), timeout: 15_000, windowsHide: true })
    return parseVersion(stdout)
  } catch {
    return null
  }
}

async function latestVersion(): Promise<string | null> {
  try {
    const res = await fetch(LATEST_URL, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return null
    const data = (await res.json()) as { version?: unknown }
    return typeof data.version === 'string' ? data.version : null
  } catch {
    return null
  }
}

// "2.1.80" contra "2.1.96": mesma versão menor e menos de 10 correções de distância não é longe.
function farBehind(current: string, latest: string): boolean {
  const [a, b] = [current.split('.').map(Number), latest.split('.').map(Number)]
  if (a[0] !== b[0] || a[1] !== b[1]) return isNewer(latest, current)
  return (b[2] ?? 0) - (a[2] ?? 0) >= 10
}

const newer = (a: ClaudeBinary, b: ClaudeBinary): boolean => !!a.version && (!b.version || isNewer(a.version, b.version))

// Últimas linhas da saída de um comando que falhou: o que a tela mostra.
function failureTail(err: unknown): string {
  const e = err as { stdout?: string; stderr?: string; killed?: boolean; message?: string }
  if (e.killed) return tr('A atualização passou de 10 minutos e foi interrompida.', 'The update took more than 10 minutes and was stopped.')
  const tail = `${e.stderr ?? ''}\n${e.stdout ?? ''}`
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(-6)
    .join('\n')
  return tail || e.message || String(err)
}

export class ClaudeVersion {
  state: ClaudeVersionState = {
    checking: false,
    updating: false,
    current: null,
    others: [],
    latest: null,
    outdated: false,
    farBehind: false,
    error: null
  }
  private timer: NodeJS.Timeout | null = null
  private running: Promise<ClaudeVersionState> | null = null

  constructor(
    private onState: (state: ClaudeVersionState) => void,
    // O `claude` em uso trocou (outro arquivo ou versão nova): o que já abriu com o antigo
    // recomeça, para a lista de modelos vir do novo.
    private onChanged: () => void
  ) {}

  start(): void {
    void this.check()
    this.timer = setInterval(() => void this.check(), EVERY_MS)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  private set(patch: Partial<ClaudeVersionState>): void {
    this.state = { ...this.state, ...patch }
    this.onState(this.state)
  }

  check(): Promise<ClaudeVersionState> {
    this.running ??= this.doCheck().finally(() => {
      this.running = null
    })
    return this.running
  }

  private async doCheck(): Promise<ClaudeVersionState> {
    this.set({ checking: true })
    // No Mac, um `claude` fora dos lugares conhecidos só aparece pelo shell de login.
    await lookupClaude()
    const before = { path: claudePath(), version: this.state.current?.version ?? null }
    const [binaries, latest] = await Promise.all([
      Promise.all(allClaudes().map(async (c): Promise<ClaudeBinary> => ({ ...c, version: await versionOf(c.path) }))),
      latestVersion()
    ])
    // O mais novo; no empate, o primeiro da lista (os instalados vêm antes dos editores).
    const best = binaries.reduce<ClaudeBinary | null>((top, b) => (!top || newer(b, top) ? b : top), null)
    chooseClaude(best?.version ? best.path : null)
    const others = binaries.filter((b) => b !== best)
    const current = best && FAKE_VERSION ? { ...best, version: FAKE_VERSION } : best
    // Sem internet agora, vale a última publicada que se soube.
    const published = latest ?? this.state.latest
    this.set({
      checking: false,
      current,
      others,
      latest: published,
      outdated: !!(current?.version && published && isNewer(published, current.version)),
      farBehind: !!(current?.version && published && farBehind(current.version, published))
    })
    if (claudePath() !== before.path || (before.version && current?.version !== before.version)) this.onChanged()
    return this.state
  }

  // Atualiza o `claude` instalado mais novo com `claude update` (o das extensões é do editor, que
  // atualiza sozinho). Sem nenhum instalado, roda o instalador oficial.
  async update(): Promise<ClaudeVersionState> {
    if (this.state.updating) return this.state
    this.set({ updating: true, error: null })
    const installed = [this.state.current, ...this.state.others]
      .filter((b): b is ClaudeBinary => !!b && b.source === 'system')
      .reduce<ClaudeBinary | null>((best, b) => (!best || newer(b, best) ? b : best), null)
    let error: string | null = null
    if (installed) {
      try {
        const { file, args } = claudeCommand(['update'], installed.path)
        await run(file, args, { env: claudeEnv(installed.path), timeout: UPDATE_TIMEOUT_MS, windowsHide: true, maxBuffer: 16 * 1024 * 1024 })
      } catch (err) {
        error = failureTail(err)
      }
    } else {
      error = await runClaudeInstaller()
    }
    this.set({ updating: false, error })
    return this.check()
  }
}
