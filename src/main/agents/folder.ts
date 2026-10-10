import { readdir, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import type { AgentDef } from '../../shared/agents'
import { expandHome } from '../paths'
import { parseAgent } from './format'

export const GLOBAL_DIR = join(homedir(), '.claude', 'agents')
export const projectDir = (projectPath: string): string => join(expandHome(projectPath), '.claude', 'agents')

export async function readDir(dir: string, scope: AgentDef['scope']): Promise<AgentDef[]> {
  let names: string[]
  try {
    names = (await readdir(dir)).filter((n) => n.endsWith('.md'))
  } catch {
    return []
  }
  const agents = await Promise.all(
    names.map(async (n) => {
      const path = join(dir, n)
      try {
        return parseAgent(await readFile(path, 'utf8'), path, scope)
      } catch {
        return null
      }
    })
  )
  return agents.filter((a): a is AgentDef => a !== null).sort((a, b) => a.name.localeCompare(b.name))
}

// O agente pelo nome do cabeçalho, como a tela mostra: o arquivo pode ter outro nome (escrito à
// mão). Com dois de mesmo nome, vale o do arquivo <nome>.md. O caminho vem da própria pasta, nunca
// do nome que chegou da tela.
export function findByName(agents: AgentDef[], name: string): AgentDef | undefined {
  const same = agents.filter((a) => a.name === name)
  return same.find((a) => basename(a.path) === `${name}.md`) ?? same[0]
}
