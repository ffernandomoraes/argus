import { describe, expect, it } from 'vitest'
import type { AreaNode, CanvasNode } from '../types'
import { bringIn, takeOut } from './transfer'

// "Mover para workspace": nada pode ficar para trás (o que está dentro do grupo, as tarefas isoladas
// da pasta) nem chegar por cima de outro bloco ou com id repetido.

const group = (id: string, x: number, y: number) =>
  ({ id, type: 'area', position: { x, y }, width: 600, height: 400, style: { width: 600, height: 400 }, data: { label: id, color: '#71717a' } }) as AreaNode
const folder = (id: string, x: number, y: number, extra: { parentId?: string; of?: string } = {}) =>
  ({
    id,
    type: 'project',
    position: { x, y },
    measured: { width: 400, height: 130 },
    data: { name: id, path: `~/${id}`, color: '#fff', ...(extra.of && { worktree: { of: extra.of, base: 'main' } }) },
    ...(extra.parentId && { parentId: extra.parentId, extent: 'parent' })
  }) as CanvasNode
const byId = (nodes: CanvasNode[], id: string) => nodes.find((n) => n.id === id)!

describe('takeOut', () => {
  it('o grupo leva o que está dentro, com a posição relativa a ele', () => {
    const { rest, moved } = takeOut([group('g', 100, 100), folder('a', 10, 20, { parentId: 'g' }), folder('b', 900, 900)], 'g')
    expect(rest.map((n) => n.id)).toEqual(['b'])
    expect(moved.map((n) => n.id)).toEqual(['g', 'a'])
    expect(byId(moved, 'a').position).toEqual({ x: 10, y: 20 })
    expect(byId(moved, 'a').parentId).toBe('g')
  })

  it('a pasta leva as tarefas isoladas dela', () => {
    const { rest, moved } = takeOut([folder('a', 0, 0), folder('t', 0, 200, { of: 'a' }), folder('c', 900, 0)], 'a')
    expect(moved.map((n) => n.id)).toEqual(['a', 't'])
    expect(rest.map((n) => n.id)).toEqual(['c'])
  })

  it('o bloco que estava num grupo que fica sai dele no mesmo lugar da tela, sem seleção', () => {
    const inside = { ...folder('a', 10, 20, { parentId: 'g' }), selected: true } as CanvasNode
    const { rest, moved } = takeOut([group('g', 100, 100), inside], 'a')
    expect(rest.map((n) => n.id)).toEqual(['g'])
    expect(moved[0].parentId).toBeUndefined()
    expect(moved[0].position).toEqual({ x: 110, y: 120 })
    expect(moved[0].selected).toBeUndefined()
  })
})

describe('bringIn', () => {
  it('chega num lugar livre e leva junto quem estava em volta, na mesma disposição', () => {
    const { moved } = takeOut([folder('a', 0, 0), folder('t', 0, 200, { of: 'a' })], 'a')
    const out = bringIn([folder('x', 0, 0)], moved, 'a')
    const a = byId(out, 'a').position
    const t = byId(out, 't').position
    expect(a).not.toEqual({ x: 0, y: 0 })
    expect({ x: t.x - a.x, y: t.y - a.y }).toEqual({ x: 0, y: 200 })
  })

  it('o grupo entra antes dos filhos (o React Flow exige o pai antes)', () => {
    const { moved } = takeOut([group('g', 0, 0), folder('a', 10, 20, { parentId: 'g' })], 'g')
    const out = bringIn([folder('x', 2000, 2000)], moved, 'g')
    expect(out.findIndex((n) => n.id === 'g')).toBeLessThan(out.findIndex((n) => n.id === 'a'))
    expect(byId(out, 'a').position).toEqual({ x: 10, y: 20 })
  })

  it('com algum id já no outro canvas, nada entra', () => {
    const target = [folder('a', 0, 0)]
    expect(bringIn(target, [folder('a', 500, 500)], 'a')).toBe(target)
  })
})
