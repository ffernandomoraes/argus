import type { AreaData, CanvasNode } from '../types'
import { type Box, boxOf, FIT_PADDING, isPlaced, sizeOf, STILL } from './geometry'
import { pushAway } from './push'
import { childrenOf } from './tree'

// Tamanho do grupo diante do que tem dentro: ajustar (encolhe ou cresce para caber exato) e
// acompanhar (cresce quando o conteúdo passa da borda e, se cresceu sozinho, volta a encolher).

const GROUP_MIN_WIDTH = 320

// Redimensiona o grupo para caber exatamente nas instâncias de dentro.
// As instâncias não mudam de lugar na tela: o grupo se move e elas são compensadas.
export function fitGroupToContent(nodes: CanvasNode[], id: string): CanvasNode[] {
  const next = fitGroup(nodes, id)
  return next === nodes ? nodes : pushAway(next, [id])
}

// O ajuste sem empurrar os vizinhos (o "Organizar board" arruma os de fora depois). Grupo que
// já está do tamanho certo, no lugar certo, volta a mesma lista.
export function fitGroup(nodes: CanvasNode[], id: string): CanvasNode[] {
  const group = nodes.find((n) => n.id === id)
  const children = childrenOf(nodes, id).filter(isPlaced)
  if (!group || group.type !== 'area' || !isPlaced(group) || children.length === 0) return nodes

  const boxes = children.map(boxOf)
  const minX = Math.min(...boxes.map((b) => b.x))
  const minY = Math.min(...boxes.map((b) => b.y))
  const maxX = Math.max(...boxes.map((b) => b.x + b.width))
  const maxY = Math.max(...boxes.map((b) => b.y + b.height))

  const dx = minX - FIT_PADDING.side
  const dy = minY - FIT_PADDING.top
  const size = {
    width: Math.max(GROUP_MIN_WIDTH, maxX - minX + FIT_PADDING.side * 2),
    height: maxY - minY + FIT_PADDING.top + FIT_PADDING.bottom
  }
  const near = (value: unknown, target: number) => Math.abs(Number(value) - target) < STILL
  const fitted =
    Math.abs(dx) < STILL &&
    Math.abs(dy) < STILL &&
    near(group.width, size.width) &&
    near(group.height, size.height) &&
    near(group.style?.width, size.width) &&
    near(group.style?.height, size.height)
  if (fitted) return nodes

  return nodes.map((n) => {
    if (n.parentId === id && isPlaced(n)) return { ...n, position: { x: n.position.x - dx, y: n.position.y - dy } }
    if (n.id !== id || n.type !== 'area') return n
    return {
      ...n,
      ...size,
      data: withoutAutoGrow(n.data),
      position: { x: n.position.x + dx, y: n.position.y + dy },
      style: { ...n.style, ...size }
    }
  })
}

// Instância que cresceu (uma conversa nova, por exemplo) não pode ficar para fora da
// borda do grupo. O grupo acompanha sozinho: cresce só na direção em que o conteúdo
// passou e só o tanto que passou. Para cima ou para a esquerda ele anda e as instâncias
// são compensadas, para nada mudar de lugar na tela. Encolhe sozinho só o que cresceu sozinho:
// quando o conteúdo diminui (agentes terminando), volta até o tamanho de antes. Se a pessoa
// redimensionou no meio do caminho, não encolhe mais — vale o tamanho dela.
export function growGroupsToFit(nodes: CanvasNode[], changedIds: string[]): CanvasNode[] {
  const groupIds = new Set(
    changedIds.map((id) => nodes.find((n) => n.id === id)?.parentId).filter((id): id is string => !!id)
  )
  let out = nodes
  for (const groupId of groupIds) out = growGroup(out, groupId)
  return out
}

// Depois de uma medição (ou de um arraste dentro do grupo): o grupo cresce para caber o conteúdo e, junto com o bloco solto que
// cresceu (pasta com conversa nova, por exemplo), empurra os vizinhos. Grupo redimensionado
// na mão não entra: é decisão de quem arrasta a borda.
export function fitAfterResize(before: CanvasNode[], after: CanvasNode[], resizedIds: string[]): CanvasNode[] {
  const grown = growGroupsToFit(after, resizedIds)
  const pushers = new Set<string>()
  grown.forEach((n, i) => n.type === 'area' && n !== after[i] && pushers.add(n.id))
  for (const id of resizedIds) {
    const prev = before.find((n) => n.id === id)
    const next = grown.find((n) => n.id === id)
    // Sem medida anterior é a primeira medição (ao abrir o app), não crescimento.
    if (!prev?.measured?.height || !next || next.parentId || next.type === 'area') continue
    const a = sizeOf(prev)
    const b = sizeOf(next)
    if (b.width > a.width || b.height > a.height) pushers.add(id)
  }
  return pushers.size ? pushAway(grown, [...pushers]) : grown
}

// Fração de pixel na medida do nó não conta como transbordo, senão o grupo cresceria
// a cada medição.
const overflow = (value: number) => (value >= 1 ? Math.ceil(value) : 0)

function growGroup(nodes: CanvasNode[], groupId: string): CanvasNode[] {
  const group = nodes.find((n) => n.id === groupId)
  if (!group || group.type !== 'area' || !isPlaced(group)) return nodes
  const children = childrenOf(nodes, groupId).filter(isPlaced)
  if (children.length === 0) return nodes

  const boxes = children.map(boxOf)
  const collapsed = !!group.data.collapsed
  const size = collapsed ? (group.data.expandedSize ?? sizeOf(group)) : sizeOf(group)

  const right = overflow(Math.max(...boxes.map((b) => b.x + b.width)) + FIT_PADDING.side - size.width)
  const bottom = overflow(Math.max(...boxes.map((b) => b.y + b.height)) + FIT_PADDING.bottom - size.height)
  // Recolhido, o conteúdo está escondido: mover o grupo faria a barra saltar na tela.
  const left = collapsed ? 0 : overflow(FIT_PADDING.side - Math.min(...boxes.map((b) => b.x)))
  const top = collapsed ? 0 : overflow(FIT_PADDING.top - Math.min(...boxes.map((b) => b.y)))
  if (!right && !bottom && !left && !top) return shrinkGroup(nodes, groupId, size, boxes)

  const grown = { width: size.width + left + right, height: size.height + top + bottom }
  const autoGrownFrom = group.data.autoGrownFrom ?? size

  return nodes.map((n) => {
    if (n.parentId === groupId)
      return (left || top) && isPlaced(n) ? { ...n, position: { x: n.position.x + left, y: n.position.y + top } } : n
    if (n.id !== groupId || n.type !== 'area') return n
    // Recolhido, o tamanho novo fica guardado e aparece quando o grupo abrir.
    if (collapsed) return { ...n, data: { ...n.data, expandedSize: grown, autoGrownFrom } }
    return {
      ...n,
      ...grown,
      data: { ...n.data, autoGrownFrom },
      position: { x: n.position.x - left, y: n.position.y - top },
      style: { ...n.style, ...grown }
    }
  })
}

// O contrário do crescer: o grupo que cresceu sozinho encolhe pela direita e por baixo até
// caber o conteúdo, sem passar do tamanho que tinha antes de crescer. Chegando nele, esquece.
function shrinkGroup(nodes: CanvasNode[], groupId: string, size: Size, boxes: Box[]): CanvasNode[] {
  const group = nodes.find((n) => n.id === groupId)
  const from = group?.type === 'area' ? group.data.autoGrownFrom : undefined
  if (!group || group.type !== 'area' || !from) return nodes

  const content = {
    width: Math.ceil(Math.max(...boxes.map((b) => b.x + b.width)) + FIT_PADDING.side),
    height: Math.ceil(Math.max(...boxes.map((b) => b.y + b.height)) + FIT_PADDING.bottom)
  }
  const shrunk = {
    width: Math.min(size.width, Math.max(from.width, content.width)),
    height: Math.min(size.height, Math.max(from.height, content.height))
  }
  if (size.width - shrunk.width < 1 && size.height - shrunk.height < 1) return nodes

  const back = shrunk.width <= from.width && shrunk.height <= from.height
  const data = back ? withoutAutoGrow(group.data) : group.data
  return nodes.map((n) => {
    if (n.id !== groupId || n.type !== 'area') return n
    if (n.data.collapsed) return { ...n, data: { ...data, expandedSize: shrunk } }
    return { ...n, ...shrunk, data, style: { ...n.style, ...shrunk } }
  })
}

type Size = { width: number; height: number }

// Redimensionar na mão (ou "Ajustar ao conteúdo") vira o tamanho da pessoa: o grupo não encolhe mais sozinho.
export function withoutAutoGrow(data: AreaData): AreaData {
  if (!data.autoGrownFrom) return data
  const { autoGrownFrom: _, ...rest } = data
  return rest
}
