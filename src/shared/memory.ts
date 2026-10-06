// Arquivos de memória do Claude Code que o app mostra e edita.
// instructions: CLAUDE.md (o que você escreve). index: MEMORY.md da memória automática.
// memory: cada anotação que o Claude gravou sozinho.
export type MemoryFile = {
  // Caminho absoluto no disco.
  path: string
  fileName: string
  kind: 'instructions' | 'index' | 'memory'
  // Do cabeçalho da anotação (name, description, type), quando houver.
  name?: string
  description?: string
  type?: string
  exists: boolean
}

export type MemoryGroup = {
  id: string
  label: string
  // Pasta do projeto; vazio no grupo global.
  projectPath?: string
  files: MemoryFile[]
}

export type MemoryProject = { name: string; path: string }
