import { execFile } from 'node:child_process'
import { WSL_EXE } from './distros'
import { log } from './log'

// Processos rodando dentro de uma distro. O status que o Claude Code do Linux grava traz o pid de
// lá, que o Windows não enxerga (o process.kill daqui conferiria outro processo). A lista vem do
// /proc da distro, guardada por um instante: quem pergunta várias vezes seguidas lê uma vez só.
const FRESH_MS = 2000
const lists = new Map<string, { pids: Set<number>; at: number }>()
const running = new Set<string>()

function refresh(distro: string): void {
  const key = distro.toLowerCase()
  if (running.has(key)) return
  running.add(key)
  execFile(WSL_EXE, ['-d', distro, '--exec', 'ls', '/proc'], { timeout: 15_000, windowsHide: true }, (err, stdout) => {
    running.delete(key)
    if (err) return log(`ls /proc no WSL (${distro}) falhou`, err.message)
    const pids = new Set(String(stdout).split(/\s+/).filter((n) => /^\d+$/.test(n)).map(Number))
    lists.set(key, { pids, at: Date.now() })
  })
}

// O processo `pid` do Linux ainda roda? Antes da primeira lista, sim (o arquivo de status existe).
export function wslPidAlive(distro: string, pid: number): boolean {
  const list = lists.get(distro.toLowerCase())
  if (!list || Date.now() - list.at > FRESH_MS) refresh(distro)
  return list ? list.pids.has(pid) : true
}
