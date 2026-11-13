import { Text } from '@codemirror/state'

// Texto do arquivo no disco ↔ documento do editor. O editor trabalha sempre com "\n"; o arquivo
// volta ao disco com o fim de linha que cada linha tinha (CRLF no Windows), sem "\r" sobrando no
// meio. Arquivo misto (CRLF e LF) fica misto: editar uma linha só muda essa linha.

export type Eol = '\n' | '\r\n'

// Fim de cada quebra de linha do arquivo, na ordem, e o da maioria (CRLF só se for a maioria),
// usado nas linhas novas. Sem nenhuma quebra, o texto não diz qual é: fica o `fallback`.
export type LineEnds = { each: Eol[]; main: Eol }

export function lineEnds(text: string, fallback: Eol = '\n'): LineEnds {
  const each: Eol[] = []
  let crlf = 0
  for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) {
    const cr = i > 0 && text.charCodeAt(i - 1) === 13
    each.push(cr ? '\r\n' : '\n')
    if (cr) crlf++
  }
  const main = !each.length ? fallback : crlf > each.length - crlf ? '\r\n' : '\n'
  return { each, main }
}

// Texto do disco como documento: cada linha sem o "\r" do fim (senão aparece "␍" em toda linha).
export const toDoc = (text: string): Text => Text.of(text.split(/\r?\n/))

// Documento como texto do disco. As linhas iguais do começo e do fim (comparadas com a base, o
// texto do disco) mantêm a quebra que tinham; as do trecho editado usam a da maioria.
export function fromDoc(doc: Text, base: Text, ends: LineEnds): string {
  const before = base.toJSON()
  const after = doc.toJSON()
  const m = before.length
  const n = after.length
  let head = 0
  while (head < m && head < n && before[head] === after[head]) head++
  let tail = 0
  while (tail < m - head && tail < n - head && before[m - 1 - tail] === after[n - 1 - tail]) tail++
  const parts = [after[0]]
  for (let k = 0; k < n - 1; k++) {
    // Quebra k fica entre as linhas k e k + 1 do documento.
    const kept = k < head ? ends.each[k] : k + 1 >= n - tail ? ends.each[k + m - n] : undefined
    parts.push(kept ?? ends.main, after[k + 1])
  }
  return parts.join('')
}

// O mesmo texto só com "\n": é como o editor conta as posições.
export const withLf = (text: string): string => text.replace(/\r\n/g, '\n')

// Trecho que mudou entre dois textos (começo e fim iguais ficam de fora). Trocar só ele
// mantém a rolagem e o cursor quando o arquivo é recarregado do disco.
export function changedSpan(before: string, after: string): { from: number; to: number; insert: string } | null {
  if (before === after) return null
  let start = 0
  const max = Math.min(before.length, after.length)
  while (start < max && before[start] === after[start]) start++
  let end = 0
  while (end < max - start && before[before.length - 1 - end] === after[after.length - 1 - end]) end++
  return { from: start, to: before.length - end, insert: after.slice(start, after.length - end) }
}

// O que fazer quando o arquivo muda no disco: nada (o editor já tem esse texto), avisar (há edição
// não salva, que não é trocada sem perguntar) ou trocar o texto do editor pelo do disco.
export function diskChange(doc: Text, base: Text, disk: string): 'same' | 'conflict' | 'replace' {
  if (doc.eq(toDoc(disk))) return 'same'
  return doc.eq(base) ? 'replace' : 'conflict'
}
