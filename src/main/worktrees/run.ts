import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { childEnv, IS_WIN, prependPath, SYSTEM32, userShell } from '../platform'
import { ensureDistro, parseWslPath } from '../wsl'
import { wslCommand } from '../wsl/run'

const OUTPUT_KEEP = 4000

// Roda um comando do projeto (o install) na pasta, como o play roda o servidor: shell de login no
// Mac e no Linux (nvm e afins), cmd no Windows, o shell de login da distro no WSL. Devolve nulo se
// deu certo, ou as últimas linhas da saída.
export async function runInFolder(cwd: string, command: string, timeout: number): Promise<string | null> {
  const env = childEnv()
  delete env.CLAUDECODE
  prependPath(env, [])
  const wsl = parseWslPath(cwd)
  let file: string
  let args: string[]
  let dir = cwd
  if (wsl && IS_WIN) {
    const info = await ensureDistro(wsl.distro)
    if (!info) return `WSL (${wsl.distro})`
    const cmd = await wslCommand(wsl.distro, info, wsl.linux, ['bash', '-lic', command], {})
    file = cmd.file
    args = cmd.args
    dir = process.env.USERPROFILE || cwd
  } else if (IS_WIN) {
    file = process.env.ComSpec || join(SYSTEM32, 'cmd.exe')
    args = ['/d', '/s', '/c', `chcp 65001>nul & ${command}`]
  } else {
    file = userShell()
    args = ['-ilc', command]
  }
  return new Promise((resolve) => {
    let out = ''
    const keep = (data: Buffer) => {
      out = (out + data.toString('utf8')).slice(-OUTPUT_KEEP)
    }
    const child = spawn(file, args, { cwd: dir, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    const timer = setTimeout(() => child.kill(), timeout)
    child.stdout?.on('data', keep)
    child.stderr?.on('data', keep)
    child.on('error', (err) => {
      clearTimeout(timer)
      resolve(err.message)
    })
    child.on('exit', (code) => {
      clearTimeout(timer)
      resolve(code === 0 ? null : lastLines(out) || `${command} (${code ?? 'timeout'})`)
    })
  })
}

const lastLines = (text: string): string =>
  text
    .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(-6)
    .join('\n')
