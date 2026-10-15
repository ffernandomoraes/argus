import { createHash, randomUUID } from 'node:crypto'
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
import { parseAgentRef, PROVIDER_NAMES, type AgentRef } from '../../shared/providers'
import { providerLaunch } from '../providers/env'
import { wslLaunch } from '../wsl/launch'
import { folderArgs } from '../workspaceFolders'
import { trustGemini } from '../workspaces'
import { FOLDERS_CLAUDE_MD } from '../chats/env'
import { materializeWorktree, withWorktreeHint } from '../worktrees'

// account: conta do Claude com que o terminal abriu. shell: nome do shell, quando não é o `claude`.
// wsl: roda dentro do WSL; o pid do pseudo-terminal é o do wsl.exe, não o do `claude`. newSession:
// a conversa nova que o app escolheu para ele (só no WSL, ver wslTerminal).
export type Spawned =
  | { ok: true; pty: IPty; account: string; shell?: string; wsl?: boolean; newSession?: string }
  | { ok: false; error: string }

// Opções do `claude` que valem nos dois lugares. promptFile: as regras do orquestrador, já no
// caminho que o `claude` enxerga; dir: o mesmo para as pastas do workspace.
function claudeArgs(req: TerminalOpenRequest, promptFile?: string, dir?: (path: string) => string): string[] {
  return [
    ...(promptFile ? ['--append-system-prompt-file', promptFile] : []),
    ...folderArgs('claude', req.folders, dir),
    ...(req.sessionId ? ['--resume', req.sessionId] : []),
    ...(req.model ? ['--model', req.model] : []),
    ...(req.effort ? ['--effort', req.effort] : []),
    ...(req.settingsJson ? ['--settings', req.settingsJson] : []),
    ...(req.permissionMode ? ['--permission-mode', req.permissionMode] : [])
  ]
}

// Abre o `claude` (ou o shell do sistema, com req.shell) num pseudo-terminal na pasta. Pasta do
// WSL: dentro da distro (ver wsl/index.ts).
export async function spawnTerminal(open: TerminalOpenRequest, cwd: string): Promise<Spawned> {
  // Tarefa isolada reservada: o worktree nasce agora. Num worktree, o aviso dele vai junto das
  // regras do orquestrador.
  await materializeWorktree(cwd, '')
  const req = { ...open, systemPrompt: withWorktreeHint(open.systemPrompt, cwd) }
  const distro = distroFor(cwd)
  const agent = parseAgentRef(req.account)
  if (agent && distro)
    return {
      ok: false,
      error: tr(
        `O ${PROVIDER_NAMES[agent.provider]} ainda não roda em pastas do WSL pelo Argus. Use o Claude neste grupo.`,
        `${PROVIDER_NAMES[agent.provider]} doesn’t run in WSL folders through Argus yet. Use Claude in this group.`
      )
    }
  if (agent) return agentTerminal(req, cwd, agent)
  return distro ? wslTerminal(req, cwd, distro) : nativeTerminal(req, cwd)
}

// Outro agente (Codex, Gemini, Cursor): a tela interativa do CLI dele, com a conta do grupo. O shell
// do terminal também fica com a conta: o `codex` digitado nele entra com ela.
function agentTerminal(req: TerminalOpenRequest, cwd: string, agent: AgentRef): Spawned {
  const name = PROVIDER_NAMES[agent.provider]
  const launch = providerLaunch(agent.provider, folderArgs(agent.provider, req.folders), agent.account)
  if (launch && agent.provider === 'gemini') trustGemini(cwd, launch.env.GEMINI_CLI_HOME)
  if (!launch) return { ok: false, error: tr(`O ${name} não está instalado ou a conta não existe mais.`, `${name} isn’t installed or the account no longer exists.`) }
  const env = launch.env
  env.TERM = 'xterm-256color'
  env.COLORTERM = 'truecolor'
  prependPath(env, [CLI_BIN])
  const shell = defaultShell()
  try {
    const pty = spawn(req.shell ? shell.file : launch.file, req.shell ? shell.args : launch.args, { name: 'xterm-256color', cols: req.cols, rows: req.rows, cwd, env })
    return { ok: true, pty, account: req.account!, shell: req.shell ? basename(shell.file) : undefined }
  } catch (err) {
    return { ok: false, error: tr(`Não consegui abrir o ${name}: ${errorMessage(err)}`, `Couldn’t open ${name}: ${errorMessage(err)}`) }
  }
}

// Texto de várias linhas como argumento quebra no Windows e no WSL: vai num arquivo. Um só para
// todos os terminais, porque as regras são as mesmas (vêm das Configurações). Com o aviso de um
// worktree, que muda de pasta para pasta, um por texto.
function writePrompt(text: string): string {
  const name = text.includes('<worktree>')
    ? `worktree-prompt-${createHash('sha1').update(text).digest('hex').slice(0, 12)}.md`
    : 'orchestrator-prompt.md'
  const path = join(app.getPath('userData'), name)
  writeFileSync(path, text)
  return path
}

// No WSL o app não tem como achar pelo pid a conversa que o `claude` cria (o pid é do wsl.exe e o
// status gravado traz o do Linux): a conversa nova já abre com um id escolhido aqui.
async function wslTerminal(req: TerminalOpenRequest, cwd: string, distro: string): Promise<Spawned> {
  const newSession = req.shell || req.sessionId ? undefined : randomUUID()
  const prompt = req.systemPrompt && !req.shell ? toLinux(writePrompt(req.systemPrompt)) : undefined
  const args = [...claudeArgs(req, prompt, toLinux), ...(newSession ? ['--session-id', newSession] : [])]
  const env = { TERM: 'xterm-256color', COLORTERM: 'truecolor', ...(req.folders?.length && { [FOLDERS_CLAUDE_MD]: '1' }) }
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
  if (req.folders?.length) env[FOLDERS_CLAUDE_MD] = '1'

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
