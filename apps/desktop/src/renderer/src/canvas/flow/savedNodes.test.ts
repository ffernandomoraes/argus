import { describe, expect, it } from 'vitest'
import type { CanvasNode } from '../types'
import { nodesFromSaved } from './savedNodes'
import { forSync, mergeRemote } from './syncNodes'

// O canvas salvo volta para a tela. Um bloco estragado não pode deixar a janela em branco (o React
// Flow quebra sem posição ou com o grupo depois do filho), e o que está bom não pode sumir.

const group = (id: string, extra: Record<string, unknown> = {}) => ({ id, type: 'area', position: { x: 0, y: 0 }, data: { label: id, color: '#71717a' }, ...extra })
const folder = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'project',
  position: { x: 10, y: 20 },
  data: { name: id, path: `~/${id}`, color: '#fff' },
  ...extra
})
const ids = (nodes: { id: string }[]) => nodes.map((n) => n.id)

describe('nodesFromSaved', () => {
  it('canvas bom volta inteiro, na mesma ordem', () => {
    const saved = [group('g'), folder('a', { parentId: 'g' }), folder('b')]
    const { nodes, dropped } = nodesFromSaved(saved)
    expect(nodes).toEqual(saved)
    expect(dropped).toBe(0)
  })

  it('o que não é lista vira canvas vazio, sem erro', () => {
    expect(nodesFromSaved(null)).toEqual({ nodes: [], dropped: 0 })
    expect(nodesFromSaved({ nodes: [] })).toEqual({ nodes: [], dropped: 0 })
  })

  it('bloco estragado fica de fora e é contado; os bons ficam', () => {
    const { nodes, dropped } = nodesFromSaved([
      folder('ok'),
      { id: 'sem-posicao', type: 'project', data: {} },
      { id: 'posicao-nan', type: 'project', position: { x: Number.NaN, y: 0 }, data: {} },
      { id: 'sem-data', type: 'project', position: { x: 0, y: 0 } },
      { id: 'tipo-novo', type: 'kanban', position: { x: 0, y: 0 }, data: {} },
      'texto',
      null
    ])
    expect(ids(nodes)).toEqual(['ok'])
    expect(dropped).toBe(6)
  })

  it('tipos de teste antigos somem sem contar como estragados', () => {
    const { nodes, dropped } = nodesFromSaved([{ id: 'x', type: 'browser' }, { id: 'y', type: 'conversation' }, folder('a')])
    expect(ids(nodes)).toEqual(['a'])
    expect(dropped).toBe(0)
  })

  it('id repetido: fica o primeiro', () => {
    const { nodes, dropped } = nodesFromSaved([folder('a', { data: { name: 'primeiro', path: '~/a', color: '#fff' } }), folder('a')])
    expect(nodes).toHaveLength(1)
    expect((nodes[0] as CanvasNode).data).toMatchObject({ name: 'primeiro' })
    expect(dropped).toBe(1)
  })

  it('filho salvo antes do grupo vai para depois dele', () => {
    const { nodes } = nodesFromSaved([folder('a', { parentId: 'g' }), group('g'), folder('b')])
    expect(ids(nodes)).toEqual(['g', 'a', 'b'])
  })

  it('filho de grupo que sumiu, ou de grupos em ciclo, fica de fora', () => {
    const { nodes, dropped } = nodesFromSaved([
      folder('orfao', { parentId: 'nao-existe' }),
      group('g1', { parentId: 'g2' }),
      group('g2', { parentId: 'g1' }),
      folder('dentro', { parentId: 'g1' }),
      folder('solto')
    ])
    expect(ids(nodes)).toEqual(['solto'])
    expect(dropped).toBe(4)
  })

  it('nota antiga de tamanho fixo passa a acompanhar o texto', () => {
    const note = { id: 'n', type: 'note', position: { x: 0, y: 0 }, data: { text: 'oi', color: '#fff' }, style: { width: 200 }, width: 200, height: 80 }
    const [upgraded] = nodesFromSaved([note]).nodes
    expect(upgraded.style).toBeUndefined()
    expect(upgraded.width).toBeUndefined()
    expect(upgraded.data).toEqual(note.data)
  })
})

describe('canvas em várias janelas', () => {
  it('o que sai para o arquivo não leva seleção nem medida da janela', () => {
    const node = { ...folder('a'), selected: true, dragging: false, measured: { width: 400, height: 130 } } as CanvasNode
    expect(forSync([node])).toEqual([folder('a')])
  })

  it('o que chega de outra janela mantém a seleção e a medida desta', () => {
    const mine = { ...folder('a'), selected: true, measured: { width: 400, height: 200 } } as CanvasNode
    const theirs = folder('a', { position: { x: 99, y: 99 } }) as CanvasNode
    const [merged] = mergeRemote([mine], [theirs])
    expect(merged.position).toEqual({ x: 99, y: 99 })
    expect(merged.selected).toBe(true)
    expect(merged.measured).toEqual({ width: 400, height: 200 })
  })

  it('sem mudança, a mesma lista; bloco que não mudou, o mesmo objeto', () => {
    const a = folder('a') as CanvasNode
    const b = folder('b') as CanvasNode
    const local = [a, b]
    expect(mergeRemote(local, [folder('a'), folder('b')] as CanvasNode[])).toBe(local)
    const next = mergeRemote(local, [folder('a'), folder('b', { position: { x: 1, y: 1 } })] as CanvasNode[])
    expect(next[0]).toBe(a)
    expect(next[1]).not.toBe(b)
  })

  it('bloco apagado na outra janela some desta', () => {
    const local = [folder('a'), folder('b')] as CanvasNode[]
    expect(ids(mergeRemote(local, [folder('b')] as CanvasNode[]))).toEqual(['b'])
  })
})
