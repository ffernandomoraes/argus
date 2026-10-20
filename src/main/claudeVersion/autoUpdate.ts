import { execFile } from 'node:child_process'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { readJsonFile } from '../lib/jsonFile'
import { IS_LINUX, IS_WIN } from '../platform'
import { processTable } from '../winProcesses'
import { distroInfo, homeUnc, runningDistros, toUnc } from '../wsl'
import { log } from '../wsl/log'
import { wslCommand } from '../wsl/run'

// Atualização do Claude Code sozinha, sem nada na tela. O Claude Code se atualiza quando roda no
// terminal; quem usa só pelo Argus ficava em versão velha e perdia recursos novos (subagentes que
// não apareciam no Windows, por exemplo). Quem desligou a atualização dele de propósito fica como
// está, e o `claude update` respeita o resto das escolhas da pessoa (canal stable, versão mínima).

const UPDATE_TIMEOUT_MS = 10 * 60_000
// DISABLE_AUTOUPDATER desliga só a conferência dele, mas é o que a pessoa usa para dizer "não
// atualize"; DISABLE_UPDATES bloqueia até o `claude update`.
const OFF_VARS = ['DISABLE_AUTOUPDATER', 'DISABLE_UPDATES']
const MANAGED_LINUX = '/etc/claude-code/managed-settings.json'

const truthy = (v: unknown): boolean => /^(1|true|yes)$/i.test(String(v ?? '').trim())

function envOff(file: string): boolean {
  const r = readJsonFile<{ env?: Record<string, unknown> }>(file)
  const env = r.status === 'ok' ? r.data?.env : null
  return !!env && typeof env === 'object' && OFF_VARS.some((k) => truthy(env[k]))
}

// A pessoa desligou a atualização? Pelo ambiente, pelas configurações dela (ou da empresa) ou pelo
// `autoUpdates: false` antigo do .claude.json. `home`: pasta do usuário (a do Linux, vista pelo
// Windows, para o WSL).
function updatesOff(home: string, configDir: string, managed: string, env: NodeJS.ProcessEnv): boolean {
  if (OFF_VARS.some((k) => truthy(env[k]))) return true
  const config = readJsonFile<{ autoUpdates?: unknown }>(join(env.CLAUDE_CONFIG_DIR ? configDir : home, '.claude.json'))
  if (config.status === 'ok' && config.data?.autoUpdates === false) return true
  return envOff(join(configDir, 'settings.json')) || envOff(managed)
}

function managedSettings(): string {
  if (IS_WIN) return join(process.env.ProgramFiles ?? 'C:\\Program Files', 'ClaudeCode', 'managed-settings.json')
  if (IS_LINUX) return MANAGED_LINUX
  return '/Library/Application Support/ClaudeCode/managed-settings.json'
}

export function nativeUpdatesOff(): boolean {
  const home = homedir()
  return updatesOff(home, process.env.CLAUDE_CONFIG_DIR ?? join(home, '.claude'), managedSettings(), process.env)
}

// Windows: um `claude.exe` aberto trava o arquivo, e a troca de versão falha no meio (EBUSY), às
// vezes deixando o antigo no lugar. Conta o aberto por este arquivo ou pela pasta de versões do
// instalador oficial, e o aberto só pelo nome (o cmd.exe não põe o caminho na linha de comando).
// O de dentro da extensão do VS Code é outro arquivo e não atrapalha. Sem conseguir ler a tabela,
// conta como aberto: melhor esperar que quebrar. No Mac e no Linux o arquivo aberto não trava: o
// instalador põe cada versão numa pasta e a conversa aberta segue com a dela.
export async function claudeInUse(path: string): Promise<boolean> {
  if (!IS_WIN) return false
  const exe = path.toLowerCase()
  const versions = join(homedir(), '.local', 'share', 'claude').toLowerCase()
  const js = /\.[cm]?js$/i.test(path)
  try {
    const table = await processTable(0)
    return [...table.values()].some((p) => {
      const name = p.name.toLowerCase()
      if (name !== 'claude.exe' && !(js && name === 'node.exe')) return false
      const command = p.command.toLowerCase()
      if (command.includes(exe) || command.includes(versions)) return true
      return name === 'claude.exe' && !/^"?[^\s"]*[\\/]/.test(command)
    })
  } catch {
    return true
  }
}

// WSL: o `claude` de cada distro ligada (ligar uma desligada só para isso gastaria memória à toa).
// No Linux o arquivo aberto não trava, então pode rodar com conversa aberta. Sem versão para
// comparar: o `claude update` já não faz nada quando está em dia.
export async function updateWslClaudes(): Promise<void> {
  if (!IS_WIN) return
  for (const distro of await runningDistros()) {
    const info = distroInfo(distro)
    const home = homeUnc(distro)
    if (!info?.claude || !home) continue
    if (updatesOff(home, join(home, '.claude'), toUnc(distro, MANAGED_LINUX), {})) continue
    const { file, args } = wslCommand(distro, info, info.home, [info.claude, 'update'], {})
    await new Promise<void>((resolve) => {
      execFile(file, args, { timeout: UPDATE_TIMEOUT_MS, windowsHide: true, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
        const out = `${stdout}\n${stderr}`.trim().split(/\r?\n/).slice(-3).join(' | ')
        log(`claude update no WSL (${distro})${err ? ' falhou' : ''}`, out)
        resolve()
      })
    })
  }
}
