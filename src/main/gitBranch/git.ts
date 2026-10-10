import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { gitPath } from '../platform'

const run = promisify(execFile)

// O app roda o git sozinho (status, diff, remoto, .gitignore), sem a pessoa pedir: nada da
// configuração do repositório pode executar comando. Um projeto recebido em .zip com um .git
// preparado rodaria o que quisesse pelo core.fsmonitor a cada status. O textconv sai no diff
// (--no-textconv), e o diff externo também (--no-ext-diff). Vazio desliga o fsmonitor em qualquer
// versão do git; "false" só a partir da 2.36 (antes viraria o nome de um programa a rodar).
export const SAFE_GIT = ['-c', 'core.fsmonitor=']

export type GitOptions = { timeout?: number; maxBuffer?: number }

export async function git(cwd: string, args: string[], { timeout = 5000, maxBuffer = 1024 * 1024 }: GitOptions = {}): Promise<string> {
  return (await run(gitPath(), [...SAFE_GIT, ...args], { cwd, timeout, maxBuffer, windowsHide: true })).stdout
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
