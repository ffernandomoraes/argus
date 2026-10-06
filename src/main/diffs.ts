import type { DiffHunk } from '../shared/history'

type Line = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

// Acima disso o diff é cortado: arquivo gerado ou reescrito inteiro não trava o chat.
const MAX_LINES = 400

function capped(hunks: DiffHunk[]): DiffHunk[] {
  let left = MAX_LINES
  const out: DiffHunk[] = []
  for (const h of hunks) {
    if (left <= 0) break
    const lines = h.lines.slice(0, left)
    if (lines.length < h.lines.length) lines.push(' …')
    left -= lines.length
    out.push({ ...h, lines })
  }
  return out
}

const plus = (text: string) => text.replace(/\n$/, '').split('\n').map((l) => '+' + l)
const minus = (text: string) => text.replace(/\n$/, '').split('\n').map((l) => '-' + l)

// Diff que o Claude Code grava depois de editar (toolUseResult.structuredPatch); arquivo
// criado do zero vem sem trecho, só com o conteúdo.
export function diffFromResult(result: Line | undefined): DiffHunk[] | undefined {
  if (!result || typeof result !== 'object') return undefined
  if (Array.isArray(result.structuredPatch) && result.structuredPatch.length) {
    return capped(
      result.structuredPatch.map((h: Line) => ({ oldStart: h.oldStart, newStart: h.newStart, lines: h.lines }))
    )
  }
  if (result.type === 'create' && typeof result.content === 'string') {
    return capped([{ oldStart: 0, newStart: 1, lines: plus(result.content) }])
  }
  return undefined
}

// Diff aproximado de uma edição que ainda vai acontecer (pedido de permissão):
// o trecho antigo inteiro sai, o novo entra. Sem número de linha.
export function diffFromInput(toolName: string, input: Line): DiffHunk[] | undefined {
  if (toolName === 'Edit' && typeof input.old_string === 'string' && typeof input.new_string === 'string') {
    return capped([{ oldStart: 0, newStart: 0, lines: [...minus(input.old_string), ...plus(input.new_string)] }])
  }
  if (toolName === 'MultiEdit' && Array.isArray(input.edits)) {
    return capped(
      input.edits.map((e: Line) => ({ oldStart: 0, newStart: 0, lines: [...minus(e.old_string ?? ''), ...plus(e.new_string ?? '')] }))
    )
  }
  if (toolName === 'Write' && typeof input.content === 'string') {
    return capped([{ oldStart: 0, newStart: 0, lines: plus(input.content) }])
  }
  return undefined
}
