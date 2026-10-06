export type FileEntry = {
  name: string
  // Caminho relativo à raiz do projeto, com "/".
  path: string
  isDir: boolean
}

export type FileContent =
  | { ok: true; text: string; size: number; truncated: boolean }
  | { ok: false; error: string }
