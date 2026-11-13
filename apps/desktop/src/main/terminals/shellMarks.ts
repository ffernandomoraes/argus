// Marcas OSC 133 que a integração do Argus põe no shell do drawer (ver shellIntegration.ts): A antes
// de cada prompt, C quando um comando começa e D quando ele termina, com o código de saída. Cada uma
// leva o nonce do terminal: marca sem ele (de outro programa, como o powerlevel10k ou o shell de um
// servidor com integração própria) não conta. O xterm da tela ignora essas sequências.

// start e end: posição da marca na saída inteira do terminal (ver OutputBuffer.end).
export type ShellMark = { kind: 'A' | 'C' | 'D'; exitCode?: number; start: number; end: number }

const PREFIX = '\x1b]133;'
// Uma marca inteira: ESC ] 133 ; tipo e campos, até o BEL ou o ESC \.
const MARK = /\x1b\]133;([^\x07\x1b]*)(?:\x07|\x1b\\)/g
// Marca que começou num pedaço e não terminou: espera o próximo. Maior que isso não é marca nossa.
const CARRY_MAX = 512

export class ShellMarks {
  private carry = ''
  // Alguém imprimiu o nonce (um `set` no bash mostra as variáveis do shell): daí em diante qualquer
  // programa poderia forjar marcas, e elas deixam de valer.
  distrusted = false

  constructor(private readonly nonce: string) {}

  // data: pedaço novo da saída; start: posição dele na saída inteira.
  feed(data: string, start: number): ShellMark[] {
    const text = this.carry + data
    const base = start - this.carry.length
    this.carry = ''
    const marks: ShellMark[] = []
    // O texto fora das nossas marcas, onde o nonce não pode aparecer.
    let plain = ''
    let last = 0
    for (const m of text.matchAll(MARK)) {
      plain += text.slice(last, m.index)
      last = m.index + m[0].length
      const [kind, ...fields] = m[1].split(';')
      if (!fields.includes(`nonce=${this.nonce}`)) plain += m[0]
      else if (kind === 'A' || kind === 'C') marks.push({ kind, start: base + m.index, end: base + last })
      else if (kind === 'D') marks.push({ kind, exitCode: exitCode(fields[0]), start: base + m.index, end: base + last })
    }
    const rest = text.slice(last)
    this.carry = unfinished(rest)
    plain += rest.slice(0, rest.length - this.carry.length)
    if (plain.includes(this.nonce)) this.distrusted = true
    return this.distrusted ? [] : marks
  }
}

const exitCode = (field: string | undefined) => (field !== undefined && /^-?\d+$/.test(field) ? Number(field) : undefined)

// O fim do texto que ainda pode virar uma marca: uma começada sem o terminador, ou só o começo do
// prefixo (ESC, ESC ], ESC ] 1...).
function unfinished(text: string): string {
  const open = text.lastIndexOf(PREFIX)
  if (open >= 0) {
    const body = text.slice(open + PREFIX.length)
    const esc = body.indexOf('\x1b')
    // Um ESC só vale no fim: pode ser o começo do ESC \ que fecha a marca.
    const waiting = !body.includes('\x07') && (esc < 0 || esc === body.length - 1)
    return waiting && text.length - open <= CARRY_MAX ? text.slice(open) : ''
  }
  for (let n = Math.min(PREFIX.length - 1, text.length); n > 0; n--) {
    if (text.endsWith(PREFIX.slice(0, n))) return PREFIX.slice(0, n)
  }
  return ''
}
