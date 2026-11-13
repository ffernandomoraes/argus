import { absolutePosition, isPlaced, sizeOf } from '../operations'
import { kindOf, nameOf } from './lookup'
import type { Tool } from './tool'

const round = (n: number) => Math.round(n)

// O retrato do canvas que o Claude lê antes de mexer: cada bloco com tipo, nome, posição no
// canvas (somada a do grupo) e tamanho, e a área que está na tela. Bloco sem posição (arquivo
// estragado) fica de fora.
const verCanvas: Tool = (_args, env) => {
  const nodes = env.nodes()
  const { topLeft, bottomRight } = env.visibleArea()
  const blocos = nodes.filter(isPlaced).map((n) => {
    const p = absolutePosition(nodes, n)
    const s = sizeOf(n)
    const parent = n.parentId ? nodes.find((g) => g.id === n.parentId) : undefined
    return {
      id: n.id,
      tipo: kindOf(n),
      nome: nameOf(n),
      ...(n.type !== 'area' && n.type !== 'note' && { caminho: n.data.path }),
      ...(n.type === 'note' && { texto: n.data.text, cor: n.data.color }),
      ...(parent && { grupo: { id: parent.id, nome: nameOf(parent) } }),
      ...(n.type === 'area' && { cor: n.data.color, recolhido: !!n.data.collapsed }),
      ...(n.hidden && { escondido: true }),
      x: round(p.x),
      y: round(p.y),
      largura: round(s.width),
      altura: round(s.height)
    }
  })
  return JSON.stringify({
    area_visivel: {
      x: round(topLeft.x),
      y: round(topLeft.y),
      largura: round(bottomRight.x - topLeft.x),
      altura: round(bottomRight.y - topLeft.y)
    },
    blocos
  })
}

export const readTools: Record<string, Tool> = { ver_canvas: verCanvas }
