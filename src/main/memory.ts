import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import type { MemoryFile, MemoryGroup, MemoryProject } from '../shared/memory'
import { expandHome } from './paths'
import { sessionsDir } from './sessions'

const GLOBAL_INSTRUCTIONS = join(homedir(), '.claude', 'CLAUDE.md')
// Lugares onde o Claude Code procura instruções de um projeto.
const PROJECT_INSTRUCTIONS = ['CLAUDE.md', join('.claude', 'CLAUDE.md'), 'CLAUDE.local.md']

const exists = (path: string) =>
  stat(path)
    .then((s) => s.isFile())
    .catch(() => false)

const memoryDir = (projectPath: string) => join(sessionsDir(projectPath), 'memory')

// Cabeçalho "---\nname: ...\n---" das anotações da memória automática.
function frontmatter(text: string): Record<string, string> {
  const m = /^---\n([\s\S]*?)\n---/.exec(text)
  if (!m) return {}
  const out: Record<string, string> = {}
  for (const line of m[1].split('\n')) {
    const kv = /^\s*(name|description|type):\s*(.*)$/.exec(line)
    if (kv) out[kv[1]] = kv[2].trim()
  }
  return out
}

async function memoryFiles(projectPath: string): Promise<MemoryFile[]> {
  const dir = memoryDir(projectPath)
  let names: string[]
  try {
    names = (await readdir(dir)).filter((n) => n.endsWith('.md'))
  } catch {
    return []
  }
  const files = await Promise.all(
    names.map(async (fileName): Promise<MemoryFile> => {
      const path = join(dir, fileName)
      if (fileName === 'MEMORY.md') return { path, fileName, kind: 'index', exists: true }
      const meta = frontmatter(await readFile(path, 'utf8').catch(() => ''))
      return { path, fileName, kind: 'memory', exists: true, name: meta.name, description: meta.description, type: meta.type }
    })
  )
  // Índice primeiro, depois as anotações em ordem alfabética.
  return files.sort((a, b) => (a.kind === 'index' ? -1 : b.kind === 'index' ? 1 : a.fileName.localeCompare(b.fileName)))
}

export async function listMemory(projects: MemoryProject[]): Promise<MemoryGroup[]> {
  const global: MemoryGroup = {
    id: 'global',
    label: 'Global',
    files: [{ path: GLOBAL_INSTRUCTIONS, fileName: 'CLAUDE.md', kind: 'instructions', exists: await exists(GLOBAL_INSTRUCTIONS) }]
  }
  const groups = await Promise.all(
    projects.map(async (p): Promise<MemoryGroup> => {
      const root = expandHome(p.path)
      const instructions = await Promise.all(
        PROJECT_INSTRUCTIONS.map(async (rel) => {
          const path = join(root, rel)
          return { path, fileName: rel, kind: 'instructions' as const, exists: await exists(path) }
        })
      )
      // O CLAUDE.md da raiz aparece sempre (dá para criar); os outros, só se existirem.
      const shown = instructions.filter((f, i) => i === 0 || f.exists)
      return { id: p.path, label: p.name, projectPath: p.path, files: [...shown, ...(await memoryFiles(p.path))] }
    })
  )
  return [global, ...groups]
}

// Só lê e grava arquivos de memória: CLAUDE.md global, de projetos do canvas, ou a pasta
// de memória automática deles. Nada fora disso, mesmo que o pedido venha da interface.
function allowed(path: string, projects: MemoryProject[]): boolean {
  const full = resolve(path)
  if (full === GLOBAL_INSTRUCTIONS) return true
  return projects.some((p) => {
    const root = resolve(expandHome(p.path))
    if (PROJECT_INSTRUCTIONS.some((rel) => full === join(root, rel))) return true
    return dirname(full) === memoryDir(p.path) && basename(full).endsWith('.md')
  })
}

export async function readMemory(path: string, projects: MemoryProject[]): Promise<string | null> {
  if (!allowed(path, projects)) return null
  return readFile(path, 'utf8').catch(() => '')
}

export async function writeMemory(path: string, text: string, projects: MemoryProject[]): Promise<boolean> {
  if (!allowed(path, projects)) return false
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, text)
  return true
}
