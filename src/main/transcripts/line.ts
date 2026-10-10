// Uma linha do .jsonl do Claude Code. O formato é interno dele (pode mudar entre versões) e nada
// nele é garantido: cada campo é conferido na hora de usar, para uma linha estranha não derrubar
// a leitura da conversa inteira.
export type Line = { [key: string]: unknown }

// Objeto de verdade (não lista, não texto); o resto vira undefined.
export const obj = (x: unknown): Line | undefined =>
  x !== null && typeof x === 'object' && !Array.isArray(x) ? (x as Line) : undefined

export const str = (x: unknown): string | undefined => (typeof x === 'string' ? x : undefined)
export const num = (x: unknown): number | undefined => (typeof x === 'number' ? x : undefined)
export const arr = (x: unknown): unknown[] | undefined => (Array.isArray(x) ? x : undefined)

// Conteúdo da mensagem: texto ou lista de partes (texto, imagem, ferramenta...).
export const contentOf = (l: Line): unknown => obj(l.message)?.content

// Id e hora da linha passam adiante como vieram (no Claude Code são sempre texto).
export const idOf = (l: Line) => l.uuid as string
export const atOf = (l: Line) => l.timestamp as string | undefined

// Texto de uma linha em objeto. Linha cortada no meio (ainda sendo gravada, ou o começo de um
// trecho lido do meio do arquivo) ou que não é JSON fica de fora.
export function parseLine(raw: string): Line | null {
  if (!raw.startsWith('{')) return null
  try {
    return obj(JSON.parse(raw)) ?? null
  } catch {
    return null
  }
}
