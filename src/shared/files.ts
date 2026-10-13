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
// conflict: ao salvar com a base, o arquivo no disco já não era ela (alguém mudou por fora); nada
// foi gravado.
export type FileOpResult = { ok: true; path: string } | { ok: false; error: string; conflict?: boolean }

// Documentos, imagens e mídia: o visualizador do sistema mostra (Quick Look no Mac, app padrão no
// Windows e no Linux). O editor de código só mostraria lixo.
const SYSTEM_VIEW = (
  'pdf doc docx xls xlsx ppt pptx odt ods odp rtf pages numbers key epub ' +
  'png jpg jpeg gif webp bmp ico icns tif tiff heic avif psd ai sketch fig ' +
  'mp3 wav ogg flac m4a aac mp4 mov avi mkv webm'
).split(' ')
// Fontes, compactados e executáveis: nem o editor nem o visualizador. Abrir um .exe pelo app
// padrão rodaria o programa; o máximo é mostrar no Finder ou no Explorador.
const ONLY_REVEAL = (
  'woff woff2 ttf otf eot ' +
  'zip gz tgz tar rar 7z bz2 xz dmg pkg iso exe msi dll so dylib bin wasm jar class pyc o a sqlite db'
).split(' ')

export const NO_PREVIEW = new Set([...SYSTEM_VIEW, ...ONLY_REVEAL])

// O que fazer com um arquivo que não abre no editor, pela extensão. null = abre no editor.
export function outsideEditor(path: string): 'view' | 'reveal' | null {
  const ext = /\.([^./\\]+)$/.exec(path)?.[1]?.toLowerCase() ?? ''
  if (SYSTEM_VIEW.includes(ext)) return 'view'
  return ONLY_REVEAL.includes(ext) ? 'reveal' : null
}
