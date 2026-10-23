import { describe, expect, it } from 'vitest'
import { diffFromInput, diffFromResult } from './diffs'

describe('diffFromResult', () => {
  it('usa o trecho que o Claude Code grava depois de editar', () => {
    const hunks = diffFromResult({ structuredPatch: [{ oldStart: 3, newStart: 3, lines: [' a', '-b', '+c'] }] })
    expect(hunks).toEqual([{ oldStart: 3, newStart: 3, lines: [' a', '-b', '+c'] }])
  })

  it('arquivo criado do zero aparece todo como adicionado', () => {
    expect(diffFromResult({ type: 'create', content: 'um\ndois\n' })).toEqual([{ oldStart: 0, newStart: 1, lines: ['+um', '+dois'] }])
  })

  it('sem diff quando o resultado não traz', () => {
    expect(diffFromResult(undefined)).toBeUndefined()
    expect(diffFromResult({ structuredPatch: [] })).toBeUndefined()
  })

  // Arquivo gerado ou reescrito inteiro travava o chat: o diff tem teto de linhas e de tamanho por linha.
  it('corta diff enorme e linha enorme', () => {
    const big = Array.from({ length: 1000 }, (_, i) => `+${i}`)
    const [first, ...rest] = diffFromResult({
      structuredPatch: [
        { oldStart: 1, newStart: 1, lines: big },
        { oldStart: 900, newStart: 900, lines: ['+x'] }
      ]
    })!
    expect(first.lines).toHaveLength(401)
    expect(first.lines.at(-1)).toBe(' …')
    expect(rest).toEqual([])

    const [hunk] = diffFromResult({ type: 'create', content: 'a'.repeat(1_000_000) })!
    expect(hunk.lines[0].length).toBeLessThanOrEqual(2_002)
  })
})

describe('diffFromInput', () => {
  it('Edit: o trecho antigo sai, o novo entra', () => {
    expect(diffFromInput('Edit', { old_string: 'a\nb', new_string: 'c' })).toEqual([{ oldStart: 0, newStart: 0, lines: ['-a', '-b', '+c'] }])
  })

  it('MultiEdit: um trecho por edição; Write: tudo adicionado', () => {
    expect(diffFromInput('MultiEdit', { edits: [{ old_string: 'a', new_string: 'b' }, { new_string: 'c' }] })?.map((h) => h.lines)).toEqual([
      ['-a', '+b'],
      ['-', '+c']
    ])
    expect(diffFromInput('Write', { content: 'x\n' })?.[0].lines).toEqual(['+x'])
  })

  it('outras ferramentas não têm diff', () => {
    expect(diffFromInput('Bash', { command: 'ls' })).toBeUndefined()
  })
})
