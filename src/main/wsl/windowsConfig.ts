import { spawn } from 'node:child_process'
import { writeStdin } from '../lib/childProcess'
import { expandHome } from '../paths'
import { WSL_EXE } from './distros'
import { distroFor } from './index'
import { log } from './log'
import { windowsHome, windowsHomeReady } from './sharedLogin'

// As configurações do Windows nas pastas do WSL (Argus no Windows com o claude.exe). Numa pasta do
// WSL roda o `claude` do Linux, que lia só as configurações de lá; quem instala e configura tudo no
// Windows (relato de 2026-11-12) não via as instruções globais, skills, agents e comandos de lá.
// Agora o ~/.claude do Linux ganha links para os do Windows (a pasta da conta principal no Windows,
// vista de dentro da distro: as contas extras do Windows ligam as suas a ela).
//
// Só o que vale igual nos dois sistemas: texto. Ficam de fora o settings.json (hooks, linha de
// status), os plugins e os MCP (no .claude.json), porque guardam comandos de um sistema só
// (C:\...\node.exe, PowerShell), e o histórico, que segue no Linux.
//
// Nada do que já existe no Linux muda: o link entra só onde o Linux não tem o item (ou tem a pasta
// vazia); se a pessoa tem o seu, fica o dela. Conferido no Claude Code 2.1.322: ele carrega
// instruções, skills, agents, comandos e estilos por esses links, e um Claude novo não cria
// nenhum desses itens sozinho.

export const PORTABLE = ['CLAUDE.md', 'skills', 'agents', 'commands', 'output-styles'] as const
export type PortableItem = (typeof PORTABLE)[number]

// windows: o item do Linux é o do Windows (o link). own: o Linux tem o seu, e ele fica. none:
// nenhum dos dois tem. failed: o Windows tem e o link não pôde ser criado.
export type PortableState = 'windows' | 'own' | 'none' | 'failed'
export type WslConfig = Record<PortableItem, PortableState>

const MARK = '__ARGUS_CFG__'
const STATES: PortableState[] = ['windows', 'own', 'none', 'failed']
// O script é curto; passou disso, a conversa abre sem os links, e a próxima tenta de novo.
const TIMEOUT_MS = 20_000

// Aspas simples do shell: a pasta do Windows pode ter espaço, acento ou aspas.
const sq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`

// O script que liga os itens, rodado dentro da distro. `windowsClaudeDir`: o ~/.claude do Windows
// visto de lá (/mnt/c/Users/ana/.claude). Responde uma linha por item, com o estado dele.
export function configScript(windowsClaudeDir: string): string {
  return [
    `W=${sq(windowsClaudeDir)}`,
    'L="$HOME/.claude"',
    'mkdir -p "$L" || exit 1',
    `for p in ${PORTABLE.join(' ')}; do`,
    '  s="$W/$p"; d="$L/$p"',
    // Pasta vazia, com o item no Windows: sai, para virar o link (rmdir não apaga pasta com coisas).
    '  if [ -e "$s" ] && [ -d "$d" ] && [ ! -L "$d" ]; then rmdir "$d" 2>/dev/null; fi',
    '  if [ -L "$d" ] && [ "$(readlink "$d")" = "$s" ]; then st=windows',
    '  elif [ -e "$d" ] || [ -L "$d" ]; then st=own',
    '  elif [ ! -e "$s" ]; then st=none',
    '  elif ln -s "$s" "$d"; then st=windows',
    '  else st=failed; fi',
    `  printf '${MARK}%s=%s\\n' "$p" "$st"`,
    'done',
    ''
  ].join('\n')
}

// A resposta do script; nulo se faltar algum item (o script não rodou até o fim).
export function parseConfig(out: string): WslConfig | null {
  const found: Partial<WslConfig> = {}
  for (const line of out.split('\n')) {
    const m = /^__ARGUS_CFG__([\w.-]+)=(\w+)$/.exec(line.trim())
    if (!m) continue
    const item = PORTABLE.find((p) => p === m[1])
    const state = STATES.find((s) => s === m[2])
    if (item && state) found[item] = state
  }
  return PORTABLE.every((p) => found[p]) ? (found as WslConfig) : null
}

// O resultado de cada distro nesta abertura do app (a chave é o nome em minúsculas), e o que está
// rodando agora: conversas abrindo juntas esperam o mesmo.
const done = new Map<string, WslConfig>()
const running = new Map<string, Promise<WslConfig | null>>()

function runScript(distro: string, windowsClaudeDir: string): Promise<WslConfig | null> {
  return new Promise((resolve) => {
    let out = ''
    let err = ''
    let settled = false
    const finish = (config: WslConfig | null, why?: string) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (config) log(`configurações do Windows no WSL (${distro})`, PORTABLE.map((p) => `${p}=${config[p]}`).join(' '))
      else log(`configurações do Windows no WSL (${distro}): não deu para ligar`, why)
      resolve(config)
    }
    // Sem matar o processo: o script só cria links, e termina sozinho.
    const timer = setTimeout(() => finish(null, `sem resposta em ${TIMEOUT_MS / 1000} s`), TIMEOUT_MS)
    const child = spawn(WSL_EXE, ['-d', distro, '--cd', '~', '--exec', 'sh', '-s'], { windowsHide: true })
    child.stdout.on('data', (d: Buffer) => (out += d.toString('utf8')))
    child.stderr.on('data', (d: Buffer) => {
      if (err.length < 1000) err += d.toString('utf8')
    })
    child.on('error', (e) => finish(null, e.message))
    child.on('close', (code) => finish(code === 0 ? parseConfig(out) : null, `saiu com ${code}: ${err.slice(0, 300)}`))
    writeStdin(child, configScript(windowsClaudeDir))
  })
}

// Liga as configurações do Windows no ~/.claude da distro, uma vez por abertura do app (de novo
// depois de forgetWslConfig). Nulo: não se aplica (o `claude` do app roda no WSL, ou a distro não
// enxerga a pasta do Windows), ou não deu para ligar agora.
export async function prepareWslConfig(distro: string): Promise<WslConfig | null> {
  await windowsHomeReady(distro)
  const home = windowsHome(distro)
  if (!home) return null
  const key = distro.toLowerCase()
  const known = done.get(key)
  if (known) return known
  let job = running.get(key)
  if (!job) {
    job = runScript(distro, `${home.replace(/\/+$/, '')}/.claude`).then((config) => {
      running.delete(key)
      if (config) done.set(key, config)
      return config
    })
    running.set(key, job)
  }
  return job
}

// O Argus criou um item no Windows (o CLAUDE.md global, um agente): a próxima conversa do WSL
// confere de novo e liga o que faltava.
export function forgetWslConfig(): void {
  done.clear()
}

// A pasta do projeto é do WSL e usa este item do Windows? É o que a tela mostra e onde ela grava:
// o mesmo que o app, a não ser que o Linux tenha o seu.
export async function usesWindowsItem(projectPath: string, item: PortableItem): Promise<boolean> {
  const full = expandHome(projectPath)
  const distro = distroFor(full)
  if (!distro || distro === distroFor()) return false
  const config = await prepareWslConfig(distro)
  return !!config && config[item] !== 'own'
}
