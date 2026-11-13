import { describe, expect, it } from 'vitest'
import type { CanvasNode } from '../types'
import { boxOf, GAP } from './geometry'
import { fitAfterResize } from './groupSize'

// Pasta dentro de um grupo que cresce (subagente aberto) não pode ficar por cima da pasta de baixo.

const group = (id: string, x: number, y: number, height: number) =>
  ({ id, type: 'area', position: { x, y }, width: 700, height, style: { width: 700, height }, data: { label: id, color: '#71717a' } }) as CanvasNode
const folder = (id: string, x: number, y: number, height: number, parentId?: string) =>
  ({
    id,
    type: 'project',
    position: { x, y },
    measured: { width: 620, height },
    data: { name: id, path: `~/${id}`, color: '#fff' },
    ...(parentId && { parentId, extent: 'parent' })
  }) as CanvasNode
const byId = (nodes: CanvasNode[], id: string) => nodes.find((n) => n.id === id)!
const resize = (nodes: CanvasNode[], id: string, height: number) =>
  nodes.map((n) => (n.id === id ? ({ ...n, measured: { width: 620, height } } as CanvasNode) : n))

describe('fitAfterResize', () => {
  it('pasta que cresce dentro do grupo empurra a irmã de baixo, e o grupo e o bloco de fora acompanham', () => {
    const before = [group('g', 0, 0, 700), folder('a', 24, 60, 300, 'g'), folder('b', 24, 400, 260, 'g'), folder('c', 0, 760, 200)]
    const after = resize(before, 'a', 500)
    const out = fitAfterResize(before, after, ['a'])

    const a = boxOf(byId(out, 'a'))
    const b = boxOf(byId(out, 'b'))
    expect(b.y).toBeGreaterThanOrEqual(a.y + a.height + GAP)
    expect(byId(out, 'b').position.x).toBe(24)

    const g = boxOf(byId(out, 'g'))
    expect(g.y + g.height).toBeGreaterThanOrEqual(byId(out, 'b').position.y + 260)
    expect(boxOf(byId(out, 'c')).y).toBeGreaterThanOrEqual(g.y + g.height + GAP)
  })

  it('primeira medição (sem medida anterior) não empurra ninguém', () => {
    const before = [group('g', 0, 0, 700), { ...folder('a', 24, 60, 300, 'g'), measured: undefined } as CanvasNode, folder('b', 24, 400, 260, 'g')]
    const after = resize(before, 'a', 500)
    expect(byId(fitAfterResize(before, after, ['a']), 'b').position).toEqual({ x: 24, y: 400 })
  })

  it('pasta que encolhe de volta puxa a irmã, o grupo e o bloco de fora para onde estavam', () => {
    // Tudo encostado, a GAP um do outro (as caixas contam o nome desenhado 30px acima).
    const start = [group('g', 0, 0, 700), folder('a', 24, 60, 300, 'g'), folder('b', 24, 414, 260, 'g'), folder('c', 0, 754, 200)]
    const opened = fitAfterResize(start, resize(start, 'a', 500), ['a'])
    const closed = fitAfterResize(opened, resize(opened, 'a', 300), ['a'])

    expect(byId(closed, 'b').position).toEqual(byId(start, 'b').position)
    expect(byId(closed, 'c').position).toEqual(byId(start, 'c').position)
    expect(boxOf(byId(closed, 'g')).height).toBe(boxOf(byId(start, 'g')).height)
  })

  it('bloco posto longe de propósito não sobe quando a pasta de cima encolhe', () => {
    const before = [group('g', 0, 0, 1200), folder('a', 24, 60, 500, 'g'), folder('b', 24, 900, 260, 'g')]
    const out = fitAfterResize(before, resize(before, 'a', 300), ['a'])
    expect(byId(out, 'b').position).toEqual({ x: 24, y: 900 })
  })

  it('não sobe por cima de outro bloco que está acima dele', () => {
    // a e d lado a lado, b embaixo dos dois: a encolhe, mas d ainda segura b.
    const before = [folder('a', 0, 0, 500), folder('d', 650, 0, 500), folder('b', 0, 500 + GAP, 200)]
    const out = fitAfterResize(before, resize(before, 'a', 300), ['a'])
    expect(byId(out, 'b').position.y).toBe(500 + GAP)
  })
})
