import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, realpathSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import type { ProjectServer } from '../shared/devServers'
import { scanListening, terminate, type Listening } from './devServers'
import { expandHome } from './paths'

// Scripts do package.json, na ordem de preferência.
const SCRIPTS = ['dev', 'start']
const MANAGERS = /^(pnpm|yarn|npm|bun)$/
const LOCKFILES: [string, string][] = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
  ['package-lock.json', 'npm']
]
// Só o fim da saída interessa: é onde fica o erro de quem não subiu.
const OUTPUT_LIMIT = 8000

type Started = { child: ChildProcess; output: string; stopping: boolean }
// Servidores iniciados por este app, pela pasta real do projeto.
const started = new Map<string, Started>()
const errors = new Map<string, string>()

// O lsof devolve a pasta real (sem atalhos); a do projeto precisa estar igual para comparar.
function realRoot(path: string): string {
  const full = resolve(expandHome(path))
  try {
    return realpathSync.native(full)
  } catch {
    return full
  }
}

const inside = (root: string, cwd: string) => cwd === root || cwd.startsWith(root + sep)

// Em monorepo, a trava do gerenciador fica numa pasta acima do pacote.
function packageManager(root: string, declared: unknown): string {
  const name = typeof declared === 'string' ? declared.split('@')[0] : ''
  if (MANAGERS.test(name)) return name
  for (let dir = root; ; dir = dirname(dir)) {
    const hit = LOCKFILES.find(([file]) => existsSync(join(dir, file)))
    if (hit) return hit[1]
    if (dirname(dir) === dir) return 'npm'
  }
}

async function projectScript(root: string): Promise<{ script: string; command: string } | null> {
  let pkg: { scripts?: Record<string, unknown>; packageManager?: unknown }
  try {
    pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  } catch {
    return null
  }
  const script = SCRIPTS.find((s) => typeof pkg.scripts?.[s] === 'string')
  if (!script) return null
  return { script, command: `${packageManager(root, pkg.packageManager)} run ${script}` }
}

// Última linha com texto, sem as cores do terminal.
function lastLine(output: string): string {
  const lines = output
    .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  return (lines.pop() ?? '').slice(0, 200)
}

// Processos com porta aberta dentro da pasta. Fora o Claude Code e o grupo dele: as portas
// deles não são o servidor do projeto.
const ofProject = (root: string, listening: Listening[]) =>
  listening.filter((p) => !p.claude && p.ports.length > 0 && inside(root, p.cwd))

async function statusOf(path: string, listening: Listening[]): Promise<ProjectServer> {
  const root = realRoot(path)
  const run = await projectScript(root)
  const mine = ofProject(root, listening)
  const base = {
    script: run?.script ?? null,
    command: run?.command ?? null,
    ports: [...new Set(mine.flatMap((p) => p.ports))].sort((a, b) => a - b)
  }
  if (mine.length > 0) {
    return { ...base, state: 'running', locked: mine.every((p) => p.locked) ? mine[0].locked : undefined }
  }
  if (started.has(root)) return { ...base, state: 'starting' }
  return { ...base, state: 'stopped', error: errors.get(root) }
}

// Uma varredura de portas só, para todas as pastas na tela.
export async function projectServers(paths: string[]): Promise<Record<string, ProjectServer>> {
  const listening = await scanListening()
  const entries = await Promise.all(paths.map(async (path) => [path, await statusOf(path, listening)] as const))
  return Object.fromEntries(entries)
}

// Roda o script num shell de login, em segundo plano e num grupo próprio, para encerrar o
// comando inteiro depois (pnpm + vite), como o painel de servidores faz.
export async function startProjectServer(path: string): Promise<boolean> {
  const root = realRoot(path)
  if (started.has(root)) return false
  const run = await projectScript(root)
  if (!run) return false

  const env = { ...process.env }
  // Sem isso um projeto Electron abriria como Node puro.
  delete env.ELECTRON_RUN_AS_NODE
  delete env.ELECTRON_NO_ATTACH_CONSOLE
  // Não foi o Claude Code que rodou: fica fora do painel de servidores dele.
  delete env.CLAUDECODE
  env.PATH = ['/opt/homebrew/bin', '/usr/local/bin', env.PATH].filter(Boolean).join(':')

  errors.delete(root)
  // -i também: nvm e afins costumam ficar no .zshrc, que o shell só lê quando é interativo.
  const child = spawn(process.env.SHELL || '/bin/zsh', ['-ilc', `exec ${run.command}`], {
    cwd: root,
    env,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe']
  })
  const entry: Started = { child, output: '', stopping: false }
  const keep = (data: Buffer | string) => {
    entry.output = (entry.output + data.toString()).slice(-OUTPUT_LIMIT)
  }
  child.stdout?.on('data', keep)
  child.stderr?.on('data', keep)
  let done = false
  const finish = (failed: boolean) => {
    if (done) return
    done = true
    if (started.get(root) === entry) started.delete(root)
    if (failed && !entry.stopping) errors.set(root, lastLine(entry.output) || `${run.command} parou`)
  }
  child.on('error', (err) => {
    keep(err.message)
    finish(true)
  })
  // Encerrado por sinal (daqui, do painel ou de um terminal) não é erro; código diferente de zero é.
  child.on('exit', (code, signal) => finish(signal === null && code !== 0))
  started.set(root, entry)
  return true
}

// Encerra tudo da pasta com porta aberta, venha de onde vier, e o que foi iniciado daqui e
// ainda não abriu porta. O servidor de dev deste próprio app fica de fora.
export async function stopProjectServer(path: string): Promise<boolean> {
  const root = realRoot(path)
  const entry = started.get(root)
  if (entry) entry.stopping = true
  errors.delete(root)
  const groups = new Set(ofProject(root, await scanListening()).filter((p) => !p.locked).map((p) => p.pgid))
  if (entry?.child.pid) groups.add(entry.child.pid)
  if (groups.size === 0) return false
  await Promise.all([...groups].map(terminate))
  return true
}

// O app fechando: os servidores iniciados daqui rodam escondidos e ficariam soltos.
export function stopStartedServers(): void {
  for (const entry of started.values()) {
    entry.stopping = true
    if (!entry.child.pid) continue
    try {
      process.kill(-entry.child.pid, 'SIGTERM')
    } catch {
      // Já saiu.
    }
  }
}
