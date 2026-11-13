import { describe, expect, it } from 'vitest'
import type { AreaNode, CanvasNode } from '../types'
import { boundsOf, boxOf, sizeOf } from './geometry'
import { dropIntoGroup, groupUnder, leaveGroup, moveToGroup, removeGroup, terminalsIn, ungroup } from './groups'

// Entrar e sair de grupos mexe na posição de tudo: um erro aqui faz pasta pular de lugar, sumir
// dentro de um grupo recolhido ou ficar fora da tela.

const group = (id: string, x: number, y: number, extra: Partial<AreaNode['data']> = {}, size = { width: 600, height: 400 }) =>
  ({ id, type: 'area', position: { x, y }, width: size.width, height: size.height, style: { ...size }, data: { label: id, color: '#71717a', ...extra } }) as CanvasNode
const folder = (id: string, x: number, y: number, parentId?: string) =>
  ({
    id,
    type: 'project',
    position: { x, y },
    measured: { width: 400, height: 130 },
    data: { name: id, path: `~/${id}`, color: '#fff' },
    ...(parentId && { parentId, extent: 'parent' })
  }) as CanvasNode
const terminal = (id: string, parentId: string) =>
  ({ id, type: 'terminal', position: { x: 0, y: 0 }, parentId, data: { name: id, path: '~' } }) as CanvasNode
const byId = (nodes: CanvasNode[], id: string) => nodes.find((n) => n.id === id)!

describe('ungroup e removeGroup', () => {
  it('desagrupar mantém cada bloco no mesmo lugar da tela', () => {
    const out = ungroup([group('g', 100, 200), folder('a', 10, 20, 'g'), folder('b', 900, 900)], 'g')
    expect(out.map((n) => n.id)).toEqual(['a', 'b'])
    expect(byId(out, 'a').position).toEqual({ x: 110, y: 220 })
    expect(byId(out, 'a').parentId).toBeUndefined()
    expect(byId(out, 'b').position).toEqual({ x: 900, y: 900 })
  })

  it('excluir o grupo leva o que está dentro e só isso', () => {
    const out = removeGroup([group('g', 0, 0), folder('a', 0, 0, 'g'), folder('b', 0, 0), group('h', 0, 0)], 'g')
    expect(out.map((n) => n.id)).toEqual(['b', 'h'])
  })

  // O processo do terminal não morre quando o bloco some: quem exclui o grupo encerra estes.
  it('terminalsIn lista os terminais de dentro do grupo', () => {
    const nodes = [group('g', 0, 0), terminal('t1', 'g'), terminal('t2', 'h'), folder('a', 0, 0, 'g')]
    expect(terminalsIn(nodes, 'g')).toEqual(['t1'])
  })
})

describe('moveToGroup', () => {
  it('entra no grupo, num lugar livre dentro dele, depois do grupo na lista', () => {
    const out = moveToGroup([folder('a', 1000, 1000), group('g', 0, 0), folder('b', 24, 54, 'g')], 'a', 'g')
    const a = byId(out, 'a')
    expect(a.parentId).toBe('g')
    expect(out.indexOf(a)).toBeGreaterThan(out.indexOf(byId(out, 'g')))
    // Não cai em cima da pasta que já estava lá.
    const [ba, bb] = [boxOf(a), boxOf(byId(out, 'b'))]
    const overlap = ba.x < bb.x + bb.width && bb.x < ba.x + ba.width && ba.y < bb.y + bb.height && bb.y < ba.y + ba.height
    expect(overlap).toBe(false)
  })

  it('o grupo cresce para caber, nunca encolhe', () => {
    const small = group('g', 0, 0, {}, { width: 200, height: 100 })
    const out = moveToGroup([small, folder('a', 1000, 1000)], 'a', 'g')
    const g = byId(out, 'g')
    const a = byId(out, 'a')
    expect(sizeOf(g).width).toBeGreaterThanOrEqual(a.position.x + 400)
    expect(sizeOf(g).height).toBeGreaterThan(100)
  })

  it('grupo recolhido: o bloco entra escondido e o tamanho de abrir é que cresce', () => {
    const collapsed = group('g', 0, 0, { collapsed: true, expandedSize: { width: 200, height: 100 } }, { width: 280, height: 40 })
    const out = moveToGroup([collapsed, folder('a', 1000, 1000)], 'a', 'g')
    expect(byId(out, 'a').hidden).toBe(true)
    const g = byId(out, 'g') as AreaNode
    expect(sizeOf(g)).toEqual({ width: 280, height: 40 })
    expect(g.data.expandedSize!.height).toBeGreaterThan(100)
  })

  it('para fora (sem grupo): sai mantendo o lugar na tela', () => {
    const out = moveToGroup([group('g', 100, 100), folder('a', 10, 10, 'g')], 'a', null)
    expect(byId(out, 'a').parentId).toBeUndefined()
    expect(byId(out, 'a').position).toEqual({ x: 110, y: 110 })
  })

  // Arquivo estragado com id repetido: mexer em um não pode apagar o outro.
  it('com id repetido, o outro bloco continua lá', () => {
    const first = folder('a', 0, 0)
    const twin = folder('a', 500, 500)
    const out = moveToGroup([group('g', 0, 0), first, twin], 'a', 'g')
    expect(out.filter((n) => n.id === 'a')).toHaveLength(2)
    expect(out).toContain(twin)
  })
})

describe('soltar sobre um grupo', () => {
  it('groupUnder: o grupo que contém o centro do bloco, o de cima quando sobrepostos', () => {
    const below = group('baixo', 0, 0)
    const above = group('cima', 300, 0)
    const node = folder('a', 400, 50)
    expect(groupUnder([below, above, node], node)?.id).toBe('cima')
    expect(groupUnder([below, node], folder('longe', 5000, 5000))).toBeUndefined()
    expect(groupUnder([{ ...below, hidden: true } as CanvasNode], folder('b', 10, 10))).toBeUndefined()
  })

  it('dropIntoGroup: entra onde foi solto, com a posição relativa ao grupo', () => {
    const out = dropIntoGroup([group('g', 100, 100), folder('a', 150, 160)], ['a'])
    const a = byId(out, 'a')
    expect(a.parentId).toBe('g')
    expect(a.position).toEqual({ x: 50, y: 60 })
  })
})

describe('leaveGroup', () => {
  it('o bloco vai para fora, à direita do grupo, visível e solto', () => {
    const out = leaveGroup([group('g', 0, 0), folder('a', 24, 54, 'g'), folder('b', 24, 250, 'g')], 'a')
    const a = byId(out, 'a')
    const g = boxOf(byId(out, 'g'))
    expect(a.parentId).toBeUndefined()
    expect(a.hidden).toBe(false)
    expect(boxOf(a).x).toBeGreaterThanOrEqual(g.x + g.width)
  })

  it('bloco que não está em grupo fica como está', () => {
    const nodes = [folder('a', 0, 0)]
    expect(leaveGroup(nodes, 'a')).toBe(nodes)
  })
})

describe('geometry', () => {
  it('canvas vazio ou só com blocos sem posição: caixa zerada, não NaN', () => {
    expect(boundsOf([])).toEqual({ x: 0, y: 0, width: 0, height: 0 })
    expect(boundsOf([{ ...folder('a', 0, 0), position: { x: Number.NaN, y: 0 } } as CanvasNode])).toEqual({ x: 0, y: 0, width: 0, height: 0 })
  })

  it('tamanho escrito à mão no arquivo ("620px") também vale', () => {
    const node = { id: 't', type: 'terminal', position: { x: 0, y: 0 }, style: { width: '620px', height: 'x' }, data: { name: 't', path: '~' } } as CanvasNode
    expect(sizeOf(node)).toEqual({ width: 620, height: 320 })
  })
})
