import { describe, expect, it } from 'vitest'
import { screenText } from './screenText'

describe('screenText', () => {
  it('tira as cores e deixa a barra de progresso como terminou', async () => {
    const data = '\x1b[32m✓\x1b[0m passou\r\nbaixando 10%\rbaixando 100%\r\n$ '
    const { lines } = await screenText(data, [{ at: 0, cols: 80, rows: 24 }])
    expect(lines).toEqual(['✓ passou', 'baixando 100%', '$'])
  })

  it('linha quebrada por não caber na largura volta a ser uma só, com os espaços', async () => {
    const { lines } = await screenText('0123456789 abcdefghij\r\nfim\r\n', [{ at: 0, cols: 10, rows: 5 }])
    expect(lines).toEqual(['0123456789 abcdefghij', 'fim'])
  })

  it('diz em que linha e coluna o cursor estava em cada corte', async () => {
    const data = '$ ls\r\na.txt\r\nb.txt\r\n$ '
    const { lines, cuts } = await screenText(data, [{ at: 0, cols: 80, rows: 24 }], [data.indexOf('a.txt'), data.lastIndexOf('$')])
    expect(lines[cuts[0].line]).toBe('a.txt')
    expect(cuts[0].col).toBe(0)
    expect(lines.slice(cuts[0].line, cuts[1].line)).toEqual(['a.txt', 'b.txt'])
  })

  it('cada trecho no tamanho em que foi desenhado: o ConPTY posiciona o cursor pela largura de então', async () => {
    // Desenhado com 10 colunas: a linha de 15 ocupa duas, e a saída vai para a terceira pela posição.
    const data = 'aaaaaaaaaaaaaaa\r\n'
    const cut = data.length
    const all = `${data}\x1b[3;1Hsaida`
    const drawn = await screenText(all, [{ at: 0, cols: 10, rows: 3 }, { at: all.length, cols: 20, rows: 3 }], [cut])
    expect(drawn.lines.slice(drawn.cuts[0].line)).toEqual(['saida'])
    // Redesenhado só no tamanho atual, sobra uma linha em branco antes da saída.
    const current = await screenText(all, [{ at: 0, cols: 20, rows: 3 }], [cut])
    expect(current.lines.slice(current.cuts[0].line)).toEqual(['', 'saida'])
  })

  it('corte que já saiu das linhas guardadas fica em -1', async () => {
    const data = 'velho\r\n' + 'linha\r\n'.repeat(6_000)
    const { cuts } = await screenText(data, [{ at: 0, cols: 80, rows: 24 }], [0])
    expect(cuts[0].line).toBe(-1)
  })
})
