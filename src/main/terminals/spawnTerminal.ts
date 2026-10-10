import { basename, dirname } from 'node:path'
import { spawn, type IPty } from 'node-pty'
import type { TerminalOpenRequest } from '../../shared/terminal'
import { applyAccount } from '../accounts'
import { CLI_BIN } from '../cli'
import { claudeCommand, claudePath } from '../claudePath'
import { errorMessage } from '../lib/errors'
import { childEnv, defaultShell, prependPath } from '../platform'

// account: conta do Claude com que o terminal abriu. shell: nome do shell, quando não é o `claude`.
export type Spawned = { ok: true; pty: IPty; account: string; shell?: string } | { ok: false; error: string }

// Abre o `claude` (ou o shell do sistema, com req.shell) num pseudo-terminal na pasta.
export function spawnTerminal(req: TerminalOpenRequest, cwd: string): Spawned {
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
  const command = claudeCommand([
    ...(req.sessionId ? ['--resume', req.sessionId] : []),
    ...(req.model ? ['--model', req.model] : []),
    ...(req.effort ? ['--effort', req.effort] : []),
    ...(req.settingsJson ? ['--settings', req.settingsJson] : []),
    ...(req.permissionMode ? ['--permission-mode', req.permissionMode] : [])
  ], claude)
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
    return { ok: false, error: `Não consegui abrir o ${req.shell ? basename(shell.file) : 'claude'}: ${errorMessage(err)}` }
  }
}
