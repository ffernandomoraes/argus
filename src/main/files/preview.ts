import { extname } from 'node:path'

// Documentos, imagens, mídia, fontes e compactados: nem chega a ler, o editor só mostraria lixo.
const NO_PREVIEW = new Set(
  (
    'pdf doc docx xls xlsx ppt pptx odt ods odp rtf pages numbers key epub ' +
    'png jpg jpeg gif webp bmp ico icns tif tiff heic avif psd ai sketch fig ' +
    'mp3 wav ogg flac m4a aac mp4 mov avi mkv webm ' +
    'woff woff2 ttf otf eot ' +
    'zip gz tgz tar rar 7z bz2 xz dmg pkg iso exe msi dll so dylib bin wasm jar class pyc o a sqlite db'
  ).split(' ')
)

// Por que o arquivo não aparece (no editor ou no diff), decidido só pelo nome e tamanho. null = pode mostrar.
export function noPreview(file: string, size: number, limit: number, what: string): string | null {
  const ext = extname(file).slice(1).toLowerCase()
  if (NO_PREVIEW.has(ext)) return `Sem ${what} para arquivos .${ext}.`
  if (size <= limit) return null
  const mb = (size / 1_000_000).toFixed(1).replace('.', ',')
  return `Arquivo muito grande (${mb} MB), sem ${what}.`
}
