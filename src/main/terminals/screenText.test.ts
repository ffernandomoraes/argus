import { describe, expect, it } from 'vitest'
import { screenText } from './screenText'

describe('screenText', () => {
  it('tira as cores e deixa a barra de progresso como terminou', async () => {
    const data = '\x1b[32m✓\x1b[0m passou\r\nbaixando 10%\rbaixando 100%\r\n$ '
    const { lines } = await screenText(data, 80, 24)
    expect(lines).toEqual(['✓ passou', 'baixando 100%', '$'])
  })

  it('linha quebrada por não caber na largura volta a ser uma só, com os espaços', async () => {
    const { lines } = await screenText('0123456789 abcdefghij\r\nfim\r\n', 10, 5)
    expect(lines).toEqual(['0123456789 abcdefghij', 'fim'])
  })

  it('diz em que linha e coluna o cursor estava em cada corte', async () => {
    const data = '$ ls\r\na.txt\r\nb.txt\r\n$ '
    const { lines, cuts } = await screenText(data, 80, 24, [data.indexOf('a.txt'), data.lastIndexOf('$')])
    expect(lines[cuts[0].line]).toBe('a.txt')
    expect(cuts[0].col).toBe(0)
    expect(lines.slice(cuts[0].line, cuts[1].line)).toEqual(['a.txt', 'b.txt'])
  })

  it('corte que já saiu das linhas guardadas fica em -1', async () => {
    const data = 'velho\r\n' + 'linha\r\n'.repeat(6_000)
    const { cuts } = await screenText(data, 80, 24, [0])
    expect(cuts[0].line).toBe(-1)
  })
})
