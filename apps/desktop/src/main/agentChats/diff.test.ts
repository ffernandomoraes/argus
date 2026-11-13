import { describe, expect, it } from 'vitest'
import { fromTexts, fromUnified } from './diff'

// O que a pessoa vê de uma edição do Codex, do Gemini e do Cursor: o mesmo quadro de diferenças
// das edições do Claude.

describe('fromUnified (Codex)', () => {
  it('lê os trechos e as linhas, sem os cabeçalhos de arquivo', () => {
    const diff = ['--- a/src/a.ts', '+++ b/src/a.ts', '@@ -3,2 +3,3 @@', ' const a = 1', '-const b = 2', '+const b = 3', '+const c = 4', '@@ -20 +21 @@', '-x', '+y'].join('\n')
    expect(fromUnified(diff)).toEqual([
      { oldStart: 3, newStart: 3, lines: [' const a = 1', '-const b = 2', '+const b = 3', '+const c = 4'] },
      { oldStart: 20, newStart: 21, lines: ['-x', '+y'] }
    ])
  })

  it('arquivo novo sem cabeçalho de trecho: tudo adicionado', () => {
    expect(fromUnified('+++ b/novo.ts\n+linha 1\n+linha 2')).toEqual([{ oldStart: 0, newStart: 1, lines: ['+linha 1', '+linha 2'] }])
  })

  it('nada para mostrar: sem quadro', () => {
    expect(fromUnified('')).toBeUndefined()
  })

  it('edição enorme fica cortada, com o aviso de que continua', () => {
    const lines = Array.from({ length: 1000 }, (_, i) => `+linha ${i}`)
    const hunks = fromUnified(['@@ -1,0 +1,1000 @@', ...lines].join('\n'))!
    expect(hunks[0].lines).toHaveLength(401)
    expect(hunks[0].lines.at(-1)).toBe(' …')
  })
})

describe('fromTexts (Gemini e Cursor)', () => {
  it('mostra só o miolo trocado, com até 3 linhas de contexto de cada lado', () => {
    const old = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'].join('\n')
    const next = ['a', 'b', 'c', 'd', 'E', 'f', 'g', 'h', 'i'].join('\n')
    expect(fromTexts(old, next)).toEqual([{ oldStart: 2, newStart: 2, lines: [' b', ' c', ' d', '-e', '+E', ' f', ' g', ' h'] }])
  })

  it('sem o texto antigo: arquivo novo, tudo adicionado', () => {
    expect(fromTexts(null, 'um\ndois\n')).toEqual([{ oldStart: 1, newStart: 1, lines: ['+um', '+dois'] }])
  })

  it('texto igual: sem quadro', () => {
    expect(fromTexts('igual\n', 'igual')).toBeUndefined()
  })
})
