import { spawn } from 'node:child_process'
import { WSL_EXE, distroInfo, loadDistro, type DistroInfo } from './distros'
import { log } from './log'

// Claude Code numa distro que ainda não tem: o instalador oficial da Anthropic para Linux, o mesmo
// da documentação. Põe o `claude` em ~/.local/bin, o primeiro lugar onde o app procura.
export const WSL_INSTALL = 'curl -fsSL https://claude.ai/install.sh | bash'

// Baixar e instalar leva de segundos a alguns minutos, conforme a internet.
const TIMEOUT_MS = 10 * 60_000
const installing = new Map<string, Promise<DistroInfo | null>>()

// Instala sem janela (para a conversa e as conferências) e devolve o que a distro tem depois.
export function installInWsl(distro: string): Promise<DistroInfo | null> {
  const key = distro.toLowerCase()
  let p = installing.get(key)
  if (!p) {
    p = new Promise<void>((resolve) => {
      log(`instalando o Claude Code no WSL (${distro})`)
      const child = spawn(WSL_EXE, ['-d', distro, '--cd', '~', '--exec', 'bash', '-s'], { windowsHide: true })
      let out = ''
      const keep = (d: Buffer) => {
        out = (out + d.toString('utf8')).slice(-2000)
      }
      child.stdout.on('data', keep)
      child.stderr.on('data', keep)
      const timer = setTimeout(() => child.kill(), TIMEOUT_MS)
      child.on('error', () => resolve())
      child.on('close', (code) => {
        clearTimeout(timer)
        if (code) log(`instalação no WSL (${distro}) saiu com ${code}`, out.slice(-500))
        resolve()
      })
      // pipefail: sem internet o curl falha e a instalação falha junto, em vez de rodar um script vazio.
      child.stdin.end(`set -o pipefail\n${WSL_INSTALL}\n`)
    }).then(() => loadDistro(distro))
    installing.set(key, p)
    void p.finally(() => installing.delete(key))
  }
  return p
}

// Depois de uma instalação feita no terminal (à vista da pessoa), confere de tempos em tempos até o
// `claude` aparecer, para as próximas aberturas já usarem.
export function watchInstall(distro: string): void {
  let tries = 0
  const timer = setInterval(() => {
    if (++tries > 40 || distroInfo(distro)?.claude) return clearInterval(timer)
    void loadDistro(distro)
  }, 15_000)
}
