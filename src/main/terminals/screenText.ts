import { Terminal, type IMarker } from '@xterm/headless'

// A saída guardada de um terminal como texto, do jeito que a pessoa vê: redesenhada num xterm sem
// janela, sem cores e com as barras de progresso já sobrescritas. Redesenhar os 200 mil caracteres
// guardados leva uns 10 ms, então acontece só na hora de ler.

// Linhas guardadas no xterm sem janela, com folga sobre as que a leitura devolve (até 1.000).
const SCROLLBACK = 5_000

// Onde o cursor estava numa posição da saída: a linha (no texto devolvido; -1 se já saiu do que
// ficou guardado) e a coluna.
export type Cut = { line: number; col: number }

const write = (term: Terminal, data: string) => new Promise<void>((resolve) => (data ? term.write(data, resolve) : resolve()))

// cuts: posições no texto (em ordem) em que se quer saber a linha do cursor, como o começo e o fim
// de um comando. Linha quebrada por não caber na largura volta a ser uma só.
export async function screenText(data: string, cols: number, rows: number, cuts: number[] = []): Promise<{ lines: string[]; cuts: Cut[] }> {
  const term = new Terminal({ cols, rows, scrollback: SCROLLBACK, allowProposedApi: true })
  try {
    const marks: { marker: IMarker | undefined; col: number }[] = []
    let at = 0
    for (const cut of cuts) {
      const end = Math.min(Math.max(at, cut), data.length)
      await write(term, data.slice(at, end))
      at = end
      marks.push({ marker: term.registerMarker(0), col: term.buffer.active.cursorX })
    }
    await write(term, data.slice(at))

    const buffer = term.buffer.active
    const lines: string[] = []
    const lineOfRow: number[] = []
    for (let row = 0; row < buffer.length; row++) {
      const line = buffer.getLine(row)
      // Antes de uma continuação, os espaços do fim fazem parte do texto.
      const continued = !!buffer.getLine(row + 1)?.isWrapped
      const raw = line?.translateToString(!continued) ?? ''
      const text = continued ? raw : raw.trimEnd()
      if (line?.isWrapped && lines.length) lines[lines.length - 1] += text
      else lines.push(text)
      lineOfRow.push(lines.length - 1)
    }
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
    return {
      lines,
      cuts: marks.map(({ marker, col }) => ({ line: marker && !marker.isDisposed ? (lineOfRow[marker.line] ?? -1) : -1, col }))
    }
  } finally {
    term.dispose()
  }
}
