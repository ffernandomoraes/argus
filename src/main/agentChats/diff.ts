import type { DiffHunk } from '../../shared/history'

// Diferenças dos outros agentes no formato do chat (DiffHunk, o mesmo das edições do Claude).

const MAX_LINES = 400
const clip = (l: string) => (l.length > 2000 ? l.slice(0, 2000) + '…' : l)

function capped(hunks: DiffHunk[]): DiffHunk[] {
  let left = MAX_LINES
  const out: DiffHunk[] = []
  for (const h of hunks) {
    if (left <= 0) break
    const lines = h.lines.slice(0, left).map(clip)
    if (lines.length < h.lines.length) lines.push(' …')
    left -= lines.length
    out.push({ ...h, lines })
  }
  return out
}

// Diff unificado (o Codex manda assim): os trechos "@@ -a,b +c,d @@" e as linhas deles.
export function fromUnified(diff: string): DiffHunk[] | undefined {
  const hunks: DiffHunk[] = []
  let current: DiffHunk | null = null
  for (const line of diff.split('\n')) {
    const head = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
    if (head) {
      current = { oldStart: Number(head[1]), newStart: Number(head[2]), lines: [] }
      hunks.push(current)
    } else if (current && /^[ +-]/.test(line) && !/^(\+\+\+|---) /.test(line)) current.lines.push(line)
  }
  if (hunks.length) return capped(hunks)
  // Arquivo novo sem cabeçalho de trecho: tudo é adicionado.
  const added = diff.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'))
  return added.length ? capped([{ oldStart: 0, newStart: 1, lines: added }]) : undefined
}

// Texto antigo e novo (o ACP manda assim): corta o começo e o fim iguais e mostra o miolo trocado,
// com até 3 linhas de contexto de cada lado. Sem antigo: arquivo novo.
export function fromTexts(oldText: string | null | undefined, newText: string): DiffHunk[] | undefined {
  const a = oldText ? oldText.replace(/\n$/, '').split('\n') : []
  const b = newText.replace(/\n$/, '').split('\n')
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--
    endB--
  }
  if (start === endA && start === endB) return undefined
  const ctx = Math.max(0, start - 3)
  const lines = [
    ...a.slice(ctx, start).map((l) => ' ' + l),
    ...a.slice(start, endA).map((l) => '-' + l),
    ...b.slice(start, endB).map((l) => '+' + l),
    ...a.slice(endA, endA + 3).map((l) => ' ' + l)
  ]
  return capped([{ oldStart: ctx + 1, newStart: ctx + 1, lines }])
}
