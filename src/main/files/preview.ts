import { extname } from 'node:path'
import { NO_PREVIEW } from '../../shared/files'
import { locale, tr } from '../i18n'

// Por que o arquivo não aparece (no editor ou no diff), decidido só pelo nome e tamanho. null = pode mostrar.
export function noPreview(file: string, size: number, limit: number, what: 'preview' | 'diff'): string | null {
  const ext = extname(file).slice(1).toLowerCase()
  const pt = what === 'preview' ? 'pré-visualização' : 'diff'
  if (NO_PREVIEW.has(ext)) return tr(`Sem ${pt} para arquivos .${ext}.`, `No ${what} for .${ext} files.`)
  if (size <= limit) return null
  const mb = (size / 1_000_000).toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return tr(`Arquivo muito grande (${mb} MB), sem ${pt}.`, `File too large (${mb} MB), no ${what}.`)
}
