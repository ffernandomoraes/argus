import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { AgentDef, AgentSaveRequest, AgentSaveResult } from '../shared/agents'
import { expandHome } from './paths'

const GLOBAL_DIR = join(homedir(), '.claude', 'agents')
const projectDir = (projectPath: string) => join(expandHome(projectPath), '.claude', 'agents')

// Nome vira o arquivo e o @nome no chat: minúsculas, números e hífen.
const NAME = /^[a-z0-9][a-z0-9-]{0,63}$/

// Valor do cabeçalho: entre aspas (como o app grava) ou cru (como muita gente escreve à mão).
function scalar(raw: string): string {
  const v = raw.trim()
  if (v.startsWith('"')) {
    try {
      return JSON.parse(v)
    } catch {
      // aspas mal fechadas: segue cru
    }
  }
  if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1).replace(/''/g, "'")
  return v
}

function parse(text: string, path: string, scope: AgentDef['scope']): AgentDef | null {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text)
  if (!m) return null
  const head: Record<string, string> = {}
  for (const line of m[1].split('\n')) {
    const kv = /^(\w+):\s*(.*)$/.exec(line)
    if (kv) head[kv[1]] = scalar(kv[2])
  }
  if (!head.name) return null
  const tools = head.tools
    ?.split(',')
    .map((t) => t.trim())
    .filter(Boolean)
  return {
    name: head.name,
    description: head.description ?? '',
    prompt: m[2].trim(),
    tools: tools?.length ? tools : undefined,
    model: head.model && head.model !== 'inherit' ? head.model : undefined,
    scope,
    path
  }
}

// Aspas duplas no padrão JSON são YAML válido: descrição com ":" ou "#" não quebra o cabeçalho.
function serialize(a: AgentSaveRequest): string {
  const head = [
    `name: ${a.name}`,
    `description: ${JSON.stringify(a.description.replace(/\s*\n\s*/g, ' ').trim())}`,
    ...(a.tools?.length ? [`tools: ${a.tools.join(', ')}`] : []),
    ...(a.model ? [`model: ${a.model}`] : [])
  ]
  return `---\n${head.join('\n')}\n---\n\n${a.prompt.trim()}\n`
}

async function readDir(dir: string, scope: AgentDef['scope']): Promise<AgentDef[]> {
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
        return parse(await readFile(path, 'utf8'), path, scope)
      } catch {
        return null
      }
    })
  )
  return agents.filter((a): a is AgentDef => a !== null).sort((a, b) => a.name.localeCompare(b.name))
}

// Globais e, com uma pasta, também os do projeto. Mesmo nome nos dois: vale o do projeto,
// como no Claude Code.
export async function listAgents(projectPath?: string): Promise<AgentDef[]> {
  const global = await readDir(GLOBAL_DIR, 'global')
  if (!projectPath) return global
  const local = await readDir(projectDir(projectPath), 'project')
  const names = new Set(local.map((a) => a.name))
  return [...local, ...global.filter((a) => !names.has(a.name))]
}

export async function saveAgent(req: AgentSaveRequest): Promise<AgentSaveResult> {
  const name = req.name.trim()
  if (!NAME.test(name)) return { ok: false, error: 'Use só letras minúsculas, números e hífen no nome (ex.: clone-de-paginas).' }
  if (!req.description.trim()) return { ok: false, error: 'Escreva quando usar este agente: o Claude decide por essa descrição.' }
  if (!req.prompt.trim()) return { ok: false, error: 'Escreva as instruções do agente.' }

  const renamed = req.previousName && req.previousName !== name
  const path = join(GLOBAL_DIR, `${name}.md`)
  if (renamed || !req.previousName) {
    const taken = (await readDir(GLOBAL_DIR, 'global')).some((a) => a.name === name)
    if (taken) return { ok: false, error: `Já existe um agente chamado ${name}.` }
  }
  const data = { ...req, name }
  try {
    await mkdir(GLOBAL_DIR, { recursive: true })
    await writeFile(path, serialize(data), 'utf8')
    if (renamed) await unlink(join(GLOBAL_DIR, `${req.previousName}.md`)).catch(() => undefined)
  } catch (err) {
    return { ok: false, error: `Não consegui salvar: ${(err as Error).message}` }
  }
  return { ok: true, agent: { ...data, description: data.description.trim(), prompt: data.prompt.trim(), scope: 'global', path } }
}

export async function removeAgent(name: string): Promise<boolean> {
  if (!NAME.test(name)) return false
  try {
    await unlink(join(GLOBAL_DIR, `${name}.md`))
    return true
  } catch {
    return false
  }
}
