import type { DiffHunk } from './history'

export type FileEntry = {
  name: string
  // Caminho relativo à raiz do projeto, com "/".
  path: string
  isDir: boolean
  // Ignorado pelo .gitignore: aparece apagado na árvore.
  ignored: boolean
}

export type FileContent =
  | { ok: true; text: string; size: number; truncated: boolean }
  | { ok: false; error: string }

// Mudanças do arquivo desde o último commit (preparadas ou não), como o diff do VS Code.
// Arquivo novo, fora do git: tudo como linha adicionada. hunks vazio: sem mudanças.
export type FileDiff = { ok: true; hunks: DiffHunk[] } | { ok: false; error: string }

// Criar, renomear, excluir, colar, salvar. `path`: o item criado ou renomeado, relativo à raiz.
export type FileOpResult = { ok: true; path: string } | { ok: false; error: string }
