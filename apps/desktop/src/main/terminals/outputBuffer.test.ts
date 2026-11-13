import { describe, expect, it } from 'vitest'
import { OutputBuffer } from './outputBuffer'

describe('OutputBuffer', () => {
  it('sabe a posição de cada caractere na saída inteira, mesmo depois de soltar o começo', () => {
    const buffer = new OutputBuffer(10)
    buffer.push('abcdef')
    buffer.push('ghijkl')
    expect(buffer.end).toBe(12)
    // Guardados só os últimos 10: o primeiro deles é o caractere 2 da saída inteira.
    expect(buffer.saved()).toEqual({ text: 'cdefghijkl', start: 2 })
    expect(buffer.text()).toBe('cdefghijkl')
  })

  it('vazio: nada guardado, posição zero', () => {
    const buffer = new OutputBuffer(10)
    buffer.push('')
    expect(buffer.saved()).toEqual({ text: '', start: 0 })
  })
})
