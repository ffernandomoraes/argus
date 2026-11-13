import { describe, expect, it } from 'vitest'
import { ShellMarks } from './shellMarks'

const N = 'f00dcafe'
const mark = (body: string, end = '\x07') => `\x1b]133;${body}${end}`

describe('ShellMarks', () => {
  it('acha A, C e D com o nonce, com o código de saída e a posição na saída inteira', () => {
    const marks = new ShellMarks(N)
    const data = `${mark(`A;nonce=${N}`)}$ ls\r\n${mark(`C;nonce=${N}`)}a.txt\r\n${mark(`D;2;nonce=${N}`, '\x1b\\')}`
    const found = marks.feed(data, 100)
    expect(found.map((m) => [m.kind, m.exitCode])).toEqual([
      ['A', undefined],
      ['C', undefined],
      ['D', 2]
    ])
    // A posição conta a partir do começo do pedaço (100) e vai do ESC ao terminador.
    expect(found[0]).toMatchObject({ start: 100, end: 100 + mark(`A;nonce=${N}`).length })
    expect(data.slice(found[2].start - 100, found[2].end - 100)).toBe(mark(`D;2;nonce=${N}`, '\x1b\\'))
  })

  it('marca de outro programa (sem o nonce, ou com outro) não conta', () => {
    const marks = new ShellMarks(N)
    expect(marks.feed(`${mark('A')}${mark('D;0')}${mark('C;nonce=outro')}`, 0)).toEqual([])
    expect(marks.distrusted).toBe(false)
  })

  it('marca partida entre dois pedaços, em qualquer ponto, sai inteira no segundo', () => {
    const whole = `ok\r\n${mark(`D;0;nonce=${N}`, '\x1b\\')}$ `
    for (let cut = 1; cut < whole.length; cut++) {
      const marks = new ShellMarks(N)
      const first = marks.feed(whole.slice(0, cut), 0)
      const second = marks.feed(whole.slice(cut), cut)
      const found = [...first, ...second]
      expect(found, `corte em ${cut}`).toHaveLength(1)
      expect(found[0]).toMatchObject({ kind: 'D', exitCode: 0, start: 4 })
    }
  })

  it('o nonce impresso fora de uma marca (um `set` no bash) desliga as marcas dali em diante', () => {
    const marks = new ShellMarks(N)
    expect(marks.feed(`__argus_nonce=${N}\r\n${mark(`A;nonce=${N}`)}`, 0)).toEqual([])
    expect(marks.distrusted).toBe(true)
    expect(marks.feed(mark(`A;nonce=${N}`), 50)).toEqual([])
  })
})
