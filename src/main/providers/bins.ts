import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import type { ProviderId } from '../../shared/providers'
import { cmdTarget } from '../claudePath/windows'
import { findInPath, IS_WIN, loginShellPath } from '../platform'
import { toolsDir } from './paths'

// Onde está cada CLI. App aberto pelo Finder não herda o PATH do terminal: procura primeiro onde os
// instaladores oficiais põem, depois no PATH e, no Mac/Linux, no PATH do shell de login.
//
// Como abrir: um programa com argumentos na frente (o Cursor no Windows roda pelo node.exe dele; o
// Gemini que o Argus instala roda pelo Node do próprio Electron, sem exigir Node na máquina).
export type Command = { file: string; args: string[]; env?: Record<string, string> }

const home = homedir()
const LOCAL = process.env.LOCALAPPDATA ?? join(home, 'AppData', 'Local')

const CANDIDATES: Record<ProviderId, () => string[]> = {
  codex: () =>
    IS_WIN
      ? [join(LOCAL, 'Programs', 'OpenAI', 'Codex', 'bin', 'codex.exe'), join(home, '.codex', 'packages', 'standalone', 'current', 'bin', 'codex.exe')]
      : [
          join(home, '.local/bin/codex'),
          join(home, '.codex/packages/standalone/current/bin/codex'),
          '/opt/homebrew/bin/codex',
          '/usr/local/bin/codex'
        ],
  cursor: () =>
    IS_WIN
      ? [join(LOCAL, 'cursor-agent', 'agent.exe'), join(LOCAL, 'cursor-agent', 'cursor-agent.exe')]
      : [join(home, '.local/bin/agent'), join(home, '.local/bin/cursor-agent')],
  gemini: () =>
    IS_WIN
      ? []
      : [
          '/opt/homebrew/bin/gemini',
          '/usr/local/bin/gemini',
          join(home, 'Library/pnpm/bin/gemini'),
          join(home, '.local/share/pnpm/gemini'),
          join(home, '.npm-global/bin/gemini'),
          join(home, '.volta/bin/gemini'),
          join(home, '.bun/bin/gemini')
        ]
}

// Nome no PATH: o Cursor ganhou o nome `agent`, genérico demais; o antigo vem primeiro.
const PATH_NAMES: Record<ProviderId, string[]> = {
  codex: ['codex'],
  cursor: ['cursor-agent', 'agent'],
  gemini: ['gemini']
}

const shellDirs: string[] = []
let shellLooked = false

// Mac/Linux: o PATH do shell de login, uma vez (leva de meio a alguns segundos).
export async function lookupShellPath(): Promise<void> {
  if (IS_WIN || shellLooked) return
  shellLooked = true
  shellDirs.push(...(await loginShellPath()).filter((d) => isAbsolute(d)))
}

// Pastas extras do PATH para os CLIs (um `gemini` do npm chama o `node` pelo PATH).
export const shellPathDirs = (): string[] => [...shellDirs]

// Gemini instalado pelo Argus: tools/gemini/<versão>/package/bundle/gemini.js, a mais nova.
export function managedGemini(): string | null {
  const root = join(toolsDir(), 'gemini')
  let versions: string[]
  try {
    versions = readdirSync(root).filter((v) => !v.startsWith('.'))
  } catch {
    return null
  }
  const newest = versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
  for (const v of newest) {
    const js = join(root, v, 'package', 'bundle', 'gemini.js')
    if (existsSync(js)) return js
  }
  return null
}

// Cursor no Windows: o instalador copia o lançador para %LOCALAPPDATA%\cursor-agent; quem roda de
// fato é o node.exe da versão com o index.js dela (o .cmd só abriria por um shell).
function windowsCursor(): Command | null {
  const root = join(LOCAL, 'cursor-agent', 'versions')
  let versions: string[]
  try {
    versions = readdirSync(root).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
  } catch {
    return null
  }
  for (const v of versions) {
    const node = join(root, v, 'node.exe')
    const index = join(root, v, 'index.js')
    if (existsSync(node) && existsSync(index)) return { file: node, args: ['--use-system-ca', index] }
  }
  return null
}

// Script do Node (o Gemini do npm): roda pelo Node do Electron.
const electronNode = (script: string): Command => ({ file: process.execPath, args: [script], env: { ELECTRON_RUN_AS_NODE: '1' } })

export function findCommand(provider: ProviderId): Command | null {
  if (provider === 'gemini') {
    const managed = managedGemini()
    if (managed) return electronNode(managed)
  }
  if (provider === 'cursor' && IS_WIN) {
    const cursor = windowsCursor()
    if (cursor) return cursor
  }
  const known = CANDIDATES[provider]().find((p) => existsSync(p))
  if (known) return { file: known, args: [] }
  for (const name of PATH_NAMES[provider]) {
    if (IS_WIN) {
      const exe = findInPath(name)
      if (exe) return { file: exe, args: [] }
      const cmd = findInPath(name, ['.cmd'])
      const target = cmd && cmdTarget(cmd)
      if (target) return /\.[cm]?js$/i.test(target) ? electronNode(target) : { file: target, args: [] }
      continue
    }
    const inPath = findInPath(name)
    if (inPath) return { file: inPath, args: [] }
    const inShell = shellDirs.map((d) => join(d, name)).find((p) => existsSync(p))
    if (inShell) return { file: inShell, args: [] }
  }
  return null
}
