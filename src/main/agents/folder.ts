import { readdir, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import type { AgentDef, AgentProvider } from '../../shared/agents'
import { claudeDir } from '../claudeHome'
import { expandHome } from '../paths'
import { cursorAgentsDir } from '../providers/paths'
import { parseAgent, parseCodexAgent } from './format'

// Biblioteca de cada agente, na pasta que o próprio CLI lê (a da conta principal; as extras ganham
// um link para ela, em accountLinks.ts):
// - Claude: ~/.claude/agents de quem roda o Claude Code de `path`; num projeto do WSL, o do Linux.
// - Codex: ~/.codex/agents, em .toml.
// - Gemini: ~/.gemini/agents.
// - Cursor: o CLI não tem agentes globais; ficam na pasta do Argus.
export function globalDir(provider: AgentProvider, path?: string): string {
  if (provider === 'claude') return join(claudeDir(path), 'agents')
  if (provider === 'cursor') return cursorAgentsDir()
  return join(homedir(), `.${provider}`, 'agents')
}

// <pasta>/.claude/agents, .codex/agents, .gemini/agents ou .cursor/agents.
export const projectDir = (provider: AgentProvider, projectPath: string): string => join(expandHome(projectPath), `.${provider}`, 'agents')

export const agentExt = (provider: AgentProvider): string => (provider === 'codex' ? '.toml' : '.md')

export async function readDir(provider: AgentProvider, dir: string, scope: AgentDef['scope']): Promise<AgentDef[]> {
  const ext = agentExt(provider)
  let names: string[]
  try {
    names = (await readdir(dir)).filter((n) => n.endsWith(ext))
  } catch {
    return []
  }
  const parse = provider === 'codex' ? parseCodexAgent : parseAgent
  const agents = await Promise.all(
    names.map(async (n) => {
      const path = join(dir, n)
      try {
        return parse(await readFile(path, 'utf8'), path, scope)
      } catch {
        return null
      }
    })
  )
  return agents.filter((a): a is AgentDef => a !== null).sort((a, b) => a.name.localeCompare(b.name))
}

// O agente pelo nome do cabeçalho, como a tela mostra: o arquivo pode ter outro nome (escrito à
// mão). Com dois de mesmo nome, vale o do arquivo <nome>.<ext>. O caminho vem da própria pasta,
// nunca do nome que chegou da tela.
export function findByName(agents: AgentDef[], name: string, ext: string): AgentDef | undefined {
  const same = agents.filter((a) => a.name === name)
  return same.find((a) => basename(a.path) === `${name}${ext}`) ?? same[0]
}
