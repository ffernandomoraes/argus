import { randomUUID } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { app } from 'electron'
import { spawn, type IPty } from 'node-pty'
import type { TerminalOpenRequest } from '../../shared/terminal'
import { applyAccount } from '../accounts'
import { CLI_BIN } from '../cli'
import { claudeCommand, claudePath } from '../claudePath'
import { tr } from '../i18n'
import { errorMessage } from '../lib/errors'
import { childEnv, defaultShell, prependPath } from '../platform'
import { distroFor, toLinux } from '../wsl'
import { wslLaunch } from '../wsl/launch'

// account: conta do Claude com que o terminal abriu. shell: nome do shell, quando não é o `claude`.
// wsl: roda dentro do WSL; o pid do pseudo-terminal é o do wsl.exe, não o do `claude`. newSession:
// a conversa nova que o app escolheu para ele (só no WSL, ver wslTerminal).
export type Spawned =
  | { ok: true; pty: IPty; account: string; shell?: string; wsl?: boolean; newSession?: string }
  | { ok: false; error: string }

// Opções do `claude` que valem nos dois lugares. promptFile: as regras do orquestrador, já no
// caminho que o `claude` enxerga.
function claudeArgs(req: TerminalOpenRequest, promptFile?: string): string[] {
  return [
    ...(promptFile ? ['--append-system-prompt-file', promptFile] : []),
    ...(req.sessionId ? ['--resume', req.sessionId] : []),
    ...(req.model ? ['--model', req.model] : []),
    ...(req.effort ? ['--effort', req.effort] : []),
    ...(req.settingsJson ? ['--settings', req.settingsJson] : []),
    ...(req.permissionMode ? ['--permission-mode', req.permissionMode] : [])
  ]
}

// Abre o `claude` (ou o shell do sistema, com req.shell) num pseudo-terminal na pasta. Pasta do
// WSL: dentro da distro (ver wsl/index.ts).
export async function spawnTerminal(req: TerminalOpenRequest, cwd: string): Promise<Spawned> {
  const distro = distroFor(cwd)
  return distro ? wslTerminal(req, cwd, distro) : nativeTerminal(req, cwd)
}

// Texto de várias linhas como argumento quebra no Windows e no WSL: vai num arquivo. Um só para
// todos os terminais, porque as regras são as mesmas (vêm das Configurações).
function writePrompt(text: string): string {
  const path = join(app.getPath('userData'), 'orchestrator-prompt.md')
  writeFileSync(path, text)
  return path
}

// No WSL o app não tem como achar pelo pid a conversa que o `claude` cria (o pid é do wsl.exe e o
// status gravado traz o do Linux): a conversa nova já abre com um id escolhido aqui.
async function wslTerminal(req: TerminalOpenRequest, cwd: string, distro: string): Promise<Spawned> {
  const newSession = req.shell || req.sessionId ? undefined : randomUUID()
  const prompt = req.systemPrompt && !req.shell ? toLinux(writePrompt(req.systemPrompt)) : undefined
  const args = [...claudeArgs(req, prompt), ...(newSession ? ['--session-id', newSession] : [])]
  const env = { TERM: 'xterm-256color', COLORTERM: 'truecolor' }
  const l = await wslLaunch(distro, { args, shell: req.shell, account: req.account, cwd, env, visibleInstall: true })
  if (!l.ok) return l
  try {
    const pty = spawn(l.file, l.args, { name: 'xterm-256color', cols: req.cols, rows: req.rows, cwd: l.cwd, env: l.env })
    return { ok: true, pty, account: l.account, shell: req.shell ? 'bash' : undefined, wsl: true, newSession }
  } catch (err) {
    return { ok: false, error: tr(`Não consegui abrir o WSL (${distro}): ${errorMessage(err)}`, `Couldn’t open WSL (${distro}): ${errorMessage(err)}`) }
  }
}

function nativeTerminal(req: TerminalOpenRequest, cwd: string): Spawned {
  const claude = claudePath()
  const env = childEnv()
  env.TERM = 'xterm-256color'
  env.COLORTERM = 'truecolor'
  // App aberto pelo Finder não tem o PATH do terminal; o claude e o node precisam dele.
  // O `argus` entra em todo terminal do app, mesmo sem ter sido instalado no PATH.
  prependPath(env, [CLI_BIN, dirname(claude)])
  // A conta do grupo vale também no shell: o `claude` digitado nele entra com ela.
  const account = applyAccount(env, req.account)

  // No Mac, shell de login, como o Terminal: carrega .zprofile e .zshrc. No Windows, PowerShell.
  const shell = defaultShell()
  const prompt = req.systemPrompt && !req.shell ? writePrompt(req.systemPrompt) : undefined
  const command = claudeCommand(claudeArgs(req, prompt), claude)
  const program = req.shell ? shell.file : command.file

  try {
    const pty = spawn(program, req.shell ? shell.args : command.args, {
      name: 'xterm-256color',
      cols: req.cols,
      rows: req.rows,
      cwd,
      env
    })
    return { ok: true, pty, account, shell: req.shell ? basename(shell.file) : undefined }
  } catch (err) {
    const what = req.shell ? basename(shell.file) : 'claude'
    return { ok: false, error: tr(`Não consegui abrir o ${what}: ${errorMessage(err)}`, `Couldn’t open ${what}: ${errorMessage(err)}`) }
  }
}
