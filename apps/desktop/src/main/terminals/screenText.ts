import { release } from 'node:os'
import { Terminal, type IMarker } from '@xterm/headless'
import { IS_WIN } from '../platform'

// A saída guardada de um terminal como texto, do jeito que a pessoa vê: redesenhada num xterm sem
// janela, sem cores e com as barras de progresso já sobrescritas. Redesenhar os 200 mil caracteres
// guardados leva uns 10 ms, então acontece só na hora de ler.

// Linhas guardadas no xterm sem janela, com folga sobre as que a leitura devolve (até 1.000).
const SCROLLBACK = 5_000

// Onde o cursor estava numa posição da saída: a linha (no texto devolvido; -1 se já saiu do que
// ficou guardado) e a coluna.
export type Cut = { line: number; col: number }

// Tamanho do terminal a partir de uma posição do texto. O ConPTY do Windows posiciona o cursor
// conforme o tamanho: a saída redesenhada noutro tamanho embaralha, e o corte cai na linha errada.
export type Size = { at: number; cols: number; rows: number }

// Windows: o mesmo jeito de mudar de tamanho do xterm da tela (ver windowsPty em createXterm.ts).
// Sem ele, ao ganhar linhas o xterm puxa as do histórico para a tela e o ConPTY, que redesenha a
// tela inteira do topo, escreve por cima delas. O build é o terceiro número de "10.0.22631".
const windowsPty = IS_WIN ? { backend: 'conpty' as const, buildNumber: Number(release().split('.')[2]) || undefined } : undefined

const write = (term: Terminal, data: string) => new Promise<void>((resolve) => (data ? term.write(data, resolve) : resolve()))

// sizes: o tamanho do começo (at 0) e as mudanças, em ordem. cuts: posições no texto (em ordem) em
// que se quer saber a linha do cursor, como o começo e o fim de um comando. Linha quebrada por não
// caber na largura volta a ser uma só.
export async function screenText(data: string, sizes: Size[], cuts: number[] = []): Promise<{ lines: string[]; cuts: Cut[] }> {
  const [first, ...resizes] = sizes
  const term = new Terminal({ cols: first.cols, rows: first.rows, scrollback: SCROLLBACK, allowProposedApi: true, windowsPty })
  try {
    let at = 0
    let resized = 0
    // Escreve até a posição, mudando o tamanho onde ele mudou (antes de um corte na mesma posição).
    const until = async (to: number) => {
      for (; resized < resizes.length && resizes[resized].at <= to; resized++) {
        const { at: change, cols, rows } = resizes[resized]
        const end = Math.min(Math.max(at, change), data.length)
        await write(term, data.slice(at, end))
        at = end
        term.resize(cols, rows)
      }
      const end = Math.min(Math.max(at, to), data.length)
      await write(term, data.slice(at, end))
      at = end
    }
    const marks: { marker: IMarker | undefined; col: number }[] = []
    for (const cut of cuts) {
      await until(cut)
      marks.push({ marker: term.registerMarker(0), col: term.buffer.active.cursorX })
    }
    await until(Infinity)

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
