import { describe, expect, it } from 'vitest'
import { diskLevel } from './disk'
import { memoryLevel } from './memory'

// Os níveis do aviso da barra de cima. Errar aqui é aviso que não aparece quando a máquina aperta,
// ou que pisca à toa perto do limite.

const GB = 1024 ** 3

describe('memoryLevel', () => {
  it('apertado abaixo de 15% ou com o aviso do macOS; chegando lá abaixo de 20%', () => {
    expect(memoryLevel(0.5)).toBe('ok')
    expect(memoryLevel(0.19)).toBe('low')
    expect(memoryLevel(0.14)).toBe('tight')
    expect(memoryLevel(0.6, 2)).toBe('tight')
  })

  it('perto do limite, só sai do nível com folga: o aviso não some e volta a cada leitura', () => {
    expect(memoryLevel(0.16, 0, 'tight')).toBe('tight')
    expect(memoryLevel(0.19, 0, 'tight')).toBe('low')
    expect(memoryLevel(0.21, 0, 'low')).toBe('low')
    expect(memoryLevel(0.24, 0, 'low')).toBe('ok')
    expect(memoryLevel(0.21, 0, 'ok')).toBe('ok')
  })
})

describe('diskLevel', () => {
  it('cheio abaixo de 1 GB, quase cheio abaixo de 5 GB, com folga para sair', () => {
    expect(diskLevel(100 * GB)).toBe('ok')
    expect(diskLevel(4 * GB)).toBe('low')
    expect(diskLevel(0.5 * GB)).toBe('full')
    expect(diskLevel(1.2 * GB, 'full')).toBe('full')
    expect(diskLevel(5.2 * GB, 'low')).toBe('low')
    expect(diskLevel(6 * GB, 'low')).toBe('ok')
  })
})
