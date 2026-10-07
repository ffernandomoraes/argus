import type { DiffHunk } from './history'

export type FileEntry = {
  name: string
  // Caminho relativo à raiz do projeto, com "/".
  path: string
  isDir: boolean
}

export type FileContent =
  | { ok: true; text: string; size: number; truncated: boolean }
  | { ok: false; error: string }

// Mudanças do arquivo desde o último commit (preparadas ou não), como o diff do VS Code.
// Arquivo novo, fora do git: tudo como linha adicionada. hunks vazio: sem mudanças.
export type FileDiff = { ok: true; hunks: DiffHunk[] } | { ok: false; error: string }
