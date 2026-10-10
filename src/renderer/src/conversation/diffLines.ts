import type { DiffHunk } from '../../../shared/history'

export type DiffSign = '+' | '-' | ' '
export type DiffLine = { sign: DiffSign; number: number | ''; text: string }

// Linhas de um trecho com o número de cada uma no arquivo novo. Linha removida não tem número, nem
// a proposta de edição (newStart zerado).
export function diffLines(h: DiffHunk): DiffLine[] {
  let line = h.newStart
  return h.lines.map((text) => {
    const sign: DiffSign = text[0] === '+' || text[0] === '-' ? text[0] : ' '
    const number = sign === '-' || !h.newStart ? '' : line++
    return { sign, number, text: text.slice(1) }
  })
}

// "+12 −3" para o resumo da edição.
export function diffStats(hunks: DiffHunk[]): { added: number; removed: number } {
  let added = 0
  let removed = 0
  for (const h of hunks) for (const l of h.lines) l[0] === '+' ? added++ : l[0] === '-' && removed++
  return { added, removed }
}
