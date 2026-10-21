import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { MAIN_DIR } from '../accounts/paths'

// /output-style: o estilo de resposta do Claude Code. Como no `claude`, a escolha vale para a pasta
// e fica no .claude/settings.local.json dela. Vale o primeiro que tiver: local, projeto, usuário.

function styleIn(file: string): string | undefined {
  try {
    const value = JSON.parse(readFileSync(file, 'utf8')).outputStyle
    return typeof value === 'string' && value ? value : undefined
  } catch {
    return undefined
  }
}

const localFile = (cwd: string) => join(cwd, '.claude', 'settings.local.json')

export function readOutputStyle(cwd: string): string {
  return (
    styleIn(localFile(cwd)) ?? styleIn(join(cwd, '.claude', 'settings.json')) ?? styleIn(join(MAIN_DIR, 'settings.json')) ?? 'default'
  )
}

// Sem conversa aberta: grava direto no arquivo, mantendo o resto. Com ela, quem grava é o próprio
// Claude Code (ChatSession.setOutputStyle), que já aplica na sessão.
export function writeOutputStyle(cwd: string, style: string): void {
  const file = localFile(cwd)
  let current: Record<string, unknown> = {}
  if (existsSync(file)) current = JSON.parse(readFileSync(file, 'utf8'))
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify({ ...current, outputStyle: style }, null, 2)}\n`)
}
