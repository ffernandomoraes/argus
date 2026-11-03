import { filesInBlock, withoutLegacyFiles, type AttachedFile } from '../../shared/attachedFiles'
import { arr, obj, type Line } from '../transcripts/line'

// Partes de texto de um conteúdo em lista.
const textItems = (content: unknown): Line[] =>
  (arr(content) ?? []).map(obj).filter((c): c is Line => c?.type === 'text')

// O que uma ferramenta devolveu, cortado no limite.
export function resultText(content: unknown, max: number): string {
  const items = arr(content)
  const text =
    typeof content === 'string'
      ? content
      : items
        ? items
            .map((item) => {
              const c = obj(item)
              return c?.type === 'text' ? c.text : c?.type === 'image' ? '[imagem]' : ''
            })
            .join('\n')
        : ''
  return text.length > max ? text.slice(0, max) + '\n…' : text
}

// Texto que a pessoa escreveu; avisos internos (<system-reminder>, <command-name>...) ficam de fora.
export function promptText(content: unknown): string | null {
  const parts =
    typeof content === 'string'
      ? [content]
      : textItems(content).flatMap((c) => (typeof c.text === 'string' ? [c.text] : []))
  const text = parts.map((t) => t.trim()).filter((t) => t && !t.startsWith('<')).join('\n\n')
  return text || null
}

// Texto da mensagem e os anexos que não são imagem: do bloco <argus-files> ou, em mensagem antiga,
// da lista "Arquivos anexados:" que ficava no próprio texto.
export function promptParts(content: unknown): { text: string | null; files?: AttachedFile[] } {
  const parts = typeof content === 'string' ? [content] : textItems(content).map((c) => String(c.text))
  const legacy = withoutLegacyFiles(promptText(content) ?? '')
  const files = [...parts.flatMap((t) => filesInBlock(t.trim())), ...legacy.files]
  return { text: legacy.text || null, ...(files.length && { files }) }
}
