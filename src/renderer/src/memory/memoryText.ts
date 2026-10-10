import type { MemoryFile } from '../../../shared/memory'
import { parentDir, relativeTo } from '../platform'

export const TYPE_LABEL: Record<string, string> = {
  user: 'sobre você',
  feedback: 'como trabalhar',
  project: 'projeto',
  reference: 'referência'
}

export function fileLabel(f: MemoryFile): string {
  if (f.kind === 'index') return 'Índice (MEMORY.md)'
  if (f.kind === 'instructions') return f.fileName
  return f.name ?? f.fileName.replace(/\.md$/, '')
}

// Tira o cabeçalho "---...---" do texto da anotação (também com o fim de linha do Windows).
export function splitFrontmatter(text: string): string {
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n)?/, '')
}

// Parênteses não passam por encodeURIComponent e quebrariam o link do Markdown.
const encodeName = (name: string) => encodeURIComponent(name).replace(/[()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)

// [[nome]] liga uma anotação a outra; vira um link para "nome.md", que abre aqui mesmo (findLinked
// acha pelo nome do arquivo ou pelo da anotação). Um link "memory:nome" era apagado pelo Markdown,
// que só deixa passar os protocolos da web.
export const linkMemories = (text: string) => text.replace(/\[\[([^\]\n]+)\]\]/g, (_m, name: string) => `[${name}](${encodeName(name)}.md)`)

// Arquivo de um link entre anotações ([[nome]] ou arquivo.md): primeiro na mesma pasta de memória
// do arquivo aberto, depois pelo nome da anotação em qualquer pasta.
export function findLinked(files: MemoryFile[], current: MemoryFile, target: string): MemoryFile | undefined {
  const dir = parentDir(current.path)
  const slug = target.replace(/^memory:/, '').replace(/^\.\//, '')
  const name = slug.replace(/\.md$/i, '')
  const matches = (f: MemoryFile) => f.name === name || f.name === slug || f.fileName === slug || f.fileName === `${slug}.md`
  return files.find((f) => !!relativeTo(f.path, dir) && matches(f)) ?? files.find((f) => f.name === name || f.name === slug)
}
