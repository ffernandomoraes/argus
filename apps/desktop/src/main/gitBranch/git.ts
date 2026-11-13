import { execFile } from 'node:child_process'
import { homedir } from 'node:os'
import { promisify } from 'node:util'
import { limiter } from '../lib/limiter'
import { gitPath } from '../platform'
import { parseWslPath, toLinux } from '../wsl'
import { WSL_EXE } from '../wsl/distros'

const run = promisify(execFile)

// O app roda o git sozinho (status, diff, remoto, .gitignore), sem a pessoa pedir: nada da
// configuração do repositório pode executar comando. Um projeto recebido em .zip com um .git
// preparado rodaria o que quisesse pelo core.fsmonitor a cada status. O textconv sai no diff
// (--no-textconv), e o diff externo também (--no-ext-diff). Vazio desliga o fsmonitor em qualquer
// versão do git; "false" só a partir da 2.36 (antes viraria o nome de um programa a rodar).
export const SAFE_GIT = ['-c', 'core.fsmonitor=']

export type GitOptions = { timeout?: number; maxBuffer?: number; env?: NodeJS.ProcessEnv }

// Programa, argumentos e pasta para rodar o git em `cwd`. Pasta do WSL: o git de lá, pelo wsl.exe.
// O do Windows recusa a pasta (o dono é outro usuário) e veria como alterado todo arquivo
// executável e toda quebra de linha diferente; o do Linux é o mesmo que o Claude usa no projeto.
// O wsl.exe fica na pasta do usuário do Windows (o Windows não aceita pasta de rede como pasta de
// trabalho de um programa); a do Linux vai pelo --cd.
export function gitCommand(cwd: string, args: string[]): { file: string; args: string[]; cwd: string; wsl: boolean } {
  const wsl = parseWslPath(cwd)
  if (!wsl || process.platform !== 'win32') return { file: gitPath(), args: [...SAFE_GIT, ...args], cwd, wsl: false }
  // Caminhos do projeto nos argumentos (o arquivo do diff) vão como o Linux os vê.
  const linuxArgs = args.map((a) => (parseWslPath(a) ? toLinux(a) : a))
  return { file: WSL_EXE, args: ['-d', wsl.distro, '--cd', wsl.linux, '--exec', 'git', ...SAFE_GIT, ...linuxArgs], cwd: homedir(), wsl: true }
}

// Comandos do git ao mesmo tempo em cada distro do WSL. Cada um é um wsl.exe e um processo no Linux,
// e com o WSL lento as consultas de fundo (branch, git status, tarefas isoladas) se acumulavam às
// dezenas, pesando ainda mais nele (2026-10-23). Os de mais esperam a vez; o prazo de cada um só
// conta depois que ele começa.
const WSL_PARALLEL = 4
const wslTurns = new Map<string, ReturnType<typeof limiter>>()

function wslTurn(distro: string): ReturnType<typeof limiter> {
  const key = distro.toLowerCase()
  let turn = wslTurns.get(key)
  if (!turn) {
    turn = limiter(WSL_PARALLEL)
    wslTurns.set(key, turn)
  }
  return turn
}

// No WSL o prazo é maior: o primeiro wsl.exe pode ligar a máquina virtual.
export async function git(cwd: string, args: string[], { timeout = 5000, maxBuffer = 1024 * 1024, env }: GitOptions = {}): Promise<string> {
  const cmd = gitCommand(cwd, args)
  const exec = async () =>
    (
      await run(cmd.file, cmd.args, {
        cwd: cmd.cwd,
        timeout: cmd.wsl ? Math.max(timeout, 20_000) : timeout,
        maxBuffer,
        windowsHide: true,
        ...(env && { env: { ...process.env, ...env } })
      })
    ).stdout
  const distro = cmd.wsl ? parseWslPath(cwd)?.distro : undefined
  return distro ? wslTurn(distro)(exec) : exec()
}

// git diff sai com código 1 quando há diferença (--no-index); a saída ainda serve.
export async function gitOutput(cwd: string, args: string[]): Promise<string> {
  try {
    return await git(cwd, args, { timeout: 10_000, maxBuffer: 32 * 1024 * 1024 })
  } catch (err) {
    const out = (err as { stdout?: string; code?: number }).stdout
    if ((err as { code?: number }).code === 1 && out) return out
    throw err
  }
}
