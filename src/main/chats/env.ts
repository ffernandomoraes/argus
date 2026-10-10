import { dirname } from 'node:path'
import type { Options } from '@anthropic-ai/claude-agent-sdk'
import { applyAccount } from '../accounts'
import { claudePath } from '../claudePath'
import { expandHome } from '../paths'
import { childEnv, prependPath } from '../platform'

// O app aberto pelo Finder não herda o PATH do terminal, e as variáveis do Electron
// fariam o `claude` subir como Node puro. A conta escolhe a pasta de configuração; sem ela,
// vale a padrão (ver accounts/).
export function claudeEnv(claude: string, account?: string): Record<string, string> {
  const env = childEnv()
  prependPath(env, [dirname(claude)])
  applyAccount(env, account)
  return env
}

// Onde está o `claude` e com que ambiente ele sobe: o que toda sessão do SDK precisa.
export function claudeProcess(account?: string): Pick<Options, 'pathToClaudeCodeExecutable' | 'env'> {
  const claude = claudePath()
  return { pathToClaudeCodeExecutable: claude, env: claudeEnv(claude, account) }
}

// Sessão como a do Claude Code no terminal, na pasta do projeto: mesmo prompt, CLAUDE.md,
// configurações e MCPs.
export function claudeCodeOptions(
  cwd: string,
  account?: string
): Pick<Options, 'cwd' | 'pathToClaudeCodeExecutable' | 'env' | 'systemPrompt'> {
  return { cwd: expandHome(cwd), ...claudeProcess(account), systemPrompt: { type: 'preset', preset: 'claude_code' } }
}
