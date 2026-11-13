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

// Resposta de gravar: true gravou; false não deu (sem permissão, disco cheio, fora da memória);
// 'conflict' (só quando a base vai junto) o arquivo mudou no disco desde a base e nada foi gravado.
export type MemoryWriteResult = boolean | 'conflict'
