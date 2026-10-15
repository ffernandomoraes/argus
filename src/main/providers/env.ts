import { existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join } from 'node:path'
import type { ProviderId } from '../../shared/providers'
import { linkAgentsDir } from '../agents/accountLinks'
import { childEnv, prependPath } from '../platform'
import { findCommand, shellPathDirs, type Command } from './bins'
import { readKey } from './keys'
import { providerAccountDir } from './paths'
import { resolveEntry } from './registry'

// Programa, argumentos e ambiente para abrir o CLI de um agente com uma conta. Cada conta fica
// isolada pela pasta dela, como as do Claude (CLAUDE_CONFIG_DIR):
// - Codex: CODEX_HOME. O login vai para o auth.json da pasta (credenciais em arquivo, para valer
//   igual nos três sistemas; no cofre, a chave dele também depende da pasta).
// - Gemini: GEMINI_CLI_HOME (o CLI cria .gemini dentro) e a chave em GEMINI_API_KEY. As
//   configurações e MCPs do ~/.gemini da pessoa entram como padrão.
// - Cursor: a principal é a do terminal (login no cofre do sistema). As outras: CURSOR_CONFIG_DIR e
//   a chave em CURSOR_API_KEY, sem gravar credencial em lugar nenhum (AGENT_CLI_CREDENTIAL_STORE).
// Variáveis herdadas do ambiente do app (um CODEX_HOME exportado no shell) saem: quem decide é a conta.

const INHERITED = [
  'CODEX_HOME',
  'GEMINI_CLI_HOME',
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
  'GOOGLE_GENAI_USE_VERTEXAI',
  'CURSOR_CONFIG_DIR',
  'CURSOR_API_KEY',
  'CURSOR_AUTH_TOKEN',
  'AGENT_CLI_CREDENTIAL_STORE'
]

export type Launch = Command & { env: Record<string, string>; account: string }

// Nulo: o CLI não está instalado, ou o agente não tem conta.
export function providerLaunch(provider: ProviderId, args: string[], accountId?: string): Launch | null {
  const cmd = findCommand(provider)
  const entry = resolveEntry(provider, accountId)
  if (!cmd || !entry) return null
  const env = childEnv()
  for (const name of INHERITED) delete env[name]
  Object.assign(env, cmd.env)
  prependPath(env, [isAbsolute(cmd.file) ? dirname(cmd.file) : undefined, ...shellPathDirs()])
  const dir = providerAccountDir(provider, entry.id)
  if (dir) {
    mkdirSync(dir, { recursive: true })
    linkAgentsDir(provider, dir)
  }
  const extra: string[] = []

  if (provider === 'codex' && dir) {
    env.CODEX_HOME = dir
    extra.push('-c', 'cli_auth_credentials_store="file"')
  }
  if (provider === 'gemini' && dir) {
    env.GEMINI_CLI_HOME = dir
    const key = readKey(provider, entry.id)
    if (key) env.GEMINI_API_KEY = key
    const shared = join(homedir(), '.gemini', 'settings.json')
    if (existsSync(shared)) env.GEMINI_CLI_SYSTEM_DEFAULTS_PATH = shared
  }
  if (provider === 'cursor' && dir) {
    env.CURSOR_CONFIG_DIR = dir
    env.AGENT_CLI_CREDENTIAL_STORE = 'memory'
    const key = readKey(provider, entry.id)
    if (key) env.CURSOR_API_KEY = key
  }
  return { file: cmd.file, args: [...cmd.args, ...args, ...extra], env, account: entry.id }
}
