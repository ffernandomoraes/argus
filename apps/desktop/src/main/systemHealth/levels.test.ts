import { describe, expect, it } from 'vitest'
import { diskLevel } from './disk'
import { macReadingOf, memoryLevel } from './memory'

// Os níveis do aviso da barra de cima. Errar aqui é aviso que não aparece quando a máquina aperta,
// ou que pisca à toa perto do limite.

const GB = 1024 ** 3

describe('memoryLevel', () => {
  it('apertado abaixo de 10%; chegando lá abaixo de 15%', () => {
    expect(memoryLevel(0.5)).toBe('ok')
    expect(memoryLevel(0.16)).toBe('ok')
    expect(memoryLevel(0.14)).toBe('low')
    expect(memoryLevel(0.09)).toBe('tight')
  })

  it('com o aviso do macOS, a mesma cor que o Monitor de Atividade: atenção amarelo, crítico vermelho', () => {
    expect(memoryLevel(0.6, 1)).toBe('ok')
    expect(memoryLevel(0.6, 2)).toBe('low')
    expect(memoryLevel(0.6, 2, 'tight')).toBe('low')
    expect(memoryLevel(0.6, 4)).toBe('tight')
    // A fração mais grave que o aviso vale.
    expect(memoryLevel(0.09, 2)).toBe('tight')
  })

  it('perto do limite, só sai do nível com folga: o aviso não some e volta a cada leitura', () => {
    expect(memoryLevel(0.11, 0, 'tight')).toBe('tight')
    expect(memoryLevel(0.14, 0, 'tight')).toBe('low')
    expect(memoryLevel(0.16, 0, 'low')).toBe('low')
    expect(memoryLevel(0.19, 0, 'low')).toBe('ok')
    expect(memoryLevel(0.16, 0, 'ok')).toBe('ok')
  })
})

describe('macReadingOf', () => {
  // Números de um Mac de 16 GB em 2026-11-03: pressão normal, páginas de 16 KB, livres, cache de
  // arquivos e descartáveis. O "free percentage" do kernel dizia 66% nessa hora.
  const out = '1\n16384\n85694\n242728\n27791\n'

  it('disponível é livre + cache de arquivos + descartável, como o Monitor de Atividade conta', () => {
    const r = macReadingOf(out, 16 * GB)
    expect(r?.pressure).toBe(1)
    expect(r?.share).toBeCloseTo(0.34, 2)
  })

  it('sem algum dos números, não dá para saber', () => {
    expect(macReadingOf('', 16 * GB)).toBeNull()
    expect(macReadingOf('1\n16384\n85694', 16 * GB)).toBeNull()
    expect(macReadingOf('1\n16384\nabc\n242728\n27791', 16 * GB)).toBeNull()
    expect(macReadingOf(out, 0)).toBeNull()
  })
})

describe('diskLevel', () => {
  it('cheio abaixo de 1 GB, quase cheio abaixo de 3 GB, com folga para sair', () => {
    expect(diskLevel(100 * GB)).toBe('ok')
    expect(diskLevel(4 * GB)).toBe('ok')
    expect(diskLevel(2 * GB)).toBe('low')
    expect(diskLevel(0.5 * GB)).toBe('full')
    expect(diskLevel(1.2 * GB, 'full')).toBe('full')
    expect(diskLevel(3.2 * GB, 'low')).toBe('low')
    expect(diskLevel(4 * GB, 'low')).toBe('ok')
  })
})
