import { execFile, execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync, rmSync } from 'node:fs'
import { app } from 'electron'
import { tr } from '../i18n'
import { childEnv } from '../platform'
import { ensureDistro, WSL_EXE } from './distros'
import { log } from './log'
import { toUnc } from './path'
import { wslCommand } from './run'

// Servidor do projeto (o `dev` do package.json) dentro do WSL. Ele abre num grupo de processos
// próprio (setsid) e grava o número do grupo num arquivo: encerrar o wsl.exe não encerra o que roda
// no Linux, então parar é mandar o sinal ao grupo inteiro (pnpm, vite...) lá dentro.

const RUN_DIR = app.isPackaged ? '.argus/run' : '.argus-dev/run'

export type WslServer = { child: ChildProcess; stop: () => Promise<void>; stopSync: () => void }

export async function launchInWsl(distro: string, linuxCwd: string, command: string, noBrowser: boolean): Promise<WslServer | string> {
  const info = await ensureDistro(distro)
  if (!info) return tr(`Não deu para abrir o WSL (${distro}).`, `Couldn’t open WSL (${distro}).`)
  const pidFile = `${info.home}/${RUN_DIR}/server-${randomUUID()}.pid`
  // O shell de login interativo carrega o nvm e afins, como o terminal do Linux.
  const script = `echo $$ > '${pidFile}'; exec ${command}`
  // -w: o processo que o wsl.exe abre já lidera o próprio grupo, e aí o setsid se divide e sai na
  // hora com 0. Sem esperar o filho, o app via o servidor "parado sem erro" logo após o clique.
  const cmd = wslCommand(distro, info, linuxCwd, ['setsid', '-w', 'bash', '-lic', script], noBrowser ? { BROWSER: 'none' } : {})
  const child = spawn(cmd.file, cmd.args, { env: childEnv(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  const unc = toUnc(distro, pidFile)
  const group = (): string | null => {
    try {
      const pid = readFileSync(unc, 'utf8').trim()
      return /^\d+$/.test(pid) ? pid : null
    } catch {
      return null
    }
  }
  const forget = () => rmSync(unc, { force: true })
  const killArgs = (pid: string) => ['-d', distro, '--exec', 'kill', '-TERM', '--', `-${pid}`]
  return {
    child,
    stop: () =>
      new Promise<void>((resolve) => {
        const pid = group()
        if (!pid) {
          child.kill()
          return resolve()
        }
        execFile(WSL_EXE, killArgs(pid), { timeout: 10_000, windowsHide: true }, (err) => {
          if (err) log(`não deu para parar o servidor no WSL (${distro})`, err.message)
          forget()
          child.kill()
          resolve()
        })
      }),
    stopSync: () => {
      const pid = group()
      try {
        if (pid) execFileSync(WSL_EXE, killArgs(pid), { timeout: 5000, windowsHide: true })
      } catch {
        // Já saiu.
      }
      forget()
      child.kill()
    }
  }
}

// Portas que o servidor anunciou na saída ("Local: http://localhost:5173/"). No WSL o Windows não
// mostra quem abriu a porta (aparece o wslrelay.exe, ou nada), então é pela saída que o app sabe.
export function portsInOutput(text: string): number[] {
  const ports = new Set<number>()
  // O Vite destaca a porta com cor (códigos ANSI no meio do endereço).
  const plain = text.replace(/\x1b\[[0-9;]*m/g, '')
  for (const m of plain.matchAll(/https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1?\])(?::(\d{2,5}))/gi)) {
    const port = Number(m[1])
    if (port > 0 && port < 65536) ports.add(port)
  }
  return [...ports].sort((a, b) => a - b)
}
