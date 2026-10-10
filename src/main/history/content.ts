import type { MessageMark } from '../../shared/history'
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

// Marcas que o modo design põe no contexto do pedido: <argus-marca tipo="selecao">Topo › Botão</argus-marca>.
export function marksOf(content: unknown): MessageMark[] | undefined {
  const parts = typeof content === 'string' ? [content] : textItems(content).map((c) => String(c.text))
  const marks = parts.flatMap((t) =>
    [...t.matchAll(/<argus-marca tipo="([\w-]+)">([^<]{1,200})<\/argus-marca>/g)].map((m) => ({ kind: m[1], text: m[2] }))
  )
  return marks.length ? marks : undefined
}
