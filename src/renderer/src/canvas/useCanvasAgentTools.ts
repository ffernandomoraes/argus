import { useEffect, useRef, type MutableRefObject } from 'react'
import { useReactFlow, type XYPosition } from '@xyflow/react'
import type { CanvasToolCall } from '../../../shared/canvasAgent'
import { createFolderInstance, createGroup, createTerminal, PROJECT_OUTSET } from './factory'
import {
  addNode,
  fitGroupToContent,
  growGroupsToFit,
  moveToGroup,
  removeGroup,
  removeNode,
  rename,
  setGroupColor,
  sizeOf,
  toggleCollapse,
  ungroup
} from './operations'
import type { CanvasNode } from './types'

// Espaço entre blocos na grade; o mesmo respiro do grupo nas bordas.
const GAP = 40
const GROUP_PADDING = 24

class ToolError extends Error {}

type Args = Record<string, unknown>

const round = (n: number) => Math.round(n)

const nameOf = (n: CanvasNode) => (n.type === 'area' ? n.data.label : n.data.name)

const KIND = { area: 'grupo', project: 'pasta', terminal: 'terminal', chat: 'conversa' } as const
const kindOf = (n: CanvasNode) => KIND[n.type]

// O que o bloco desenha acima de si (botões da pasta); conta como espaço ocupado.
const outsetTop = (n: CanvasNode) => (n.type === 'project' ? PROJECT_OUTSET.top : 0)

function absolute(n: CanvasNode, nodes: CanvasNode[]): XYPosition {
  const parent = n.parentId ? nodes.find((p) => p.id === n.parentId) : undefined
  return parent ? { x: parent.position.x + n.position.x, y: parent.position.y + n.position.y } : n.position
}

// Aceita o id e, na falta dele, o nome: o modelo às vezes troca um pelo outro.
function find(nodes: CanvasNode[], ref: unknown): CanvasNode {
  const key = String(ref ?? '')
  const byId = nodes.find((n) => n.id === key)
  if (byId) return byId
  const byName = nodes.filter((n) => nameOf(n).toLowerCase() === key.toLowerCase())
  if (byName.length === 1) return byName[0]
  throw new ToolError(byName.length ? `Mais de um bloco chamado "${key}"; use o id.` : `Bloco "${key}" não existe.`)
}

function findGroup(nodes: CanvasNode[], ref: unknown): CanvasNode {
  const g = find(nodes, ref)
  if (g.type !== 'area') throw new ToolError(`"${nameOf(g)}" não é um grupo.`)
  return g
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)

// Executa as ações que o assistente do canvas pede. Toda mudança passa por `change`,
// então ⌘Z desfaz o que o Claude fez, uma ação por vez.
export function useCanvasAgentTools(
  nodesRef: MutableRefObject<CanvasNode[]>,
  change: (update: CanvasNode[]) => void
) {
  const { screenToFlowPosition, fitView } = useReactFlow()
  const latest = useRef({ screenToFlowPosition, fitView, change })
  latest.current = { screenToFlowPosition, fitView, change }

  useEffect(() => {
    // Aplica na hora e já atualiza a referência: a próxima ação pode chegar antes de a tela redesenhar.
    const apply = (next: CanvasNode[]) => {
      latest.current.change(next)
      nodesRef.current = next
    }

    const screenCenter = () =>
      latest.current.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })

    // Posição pedida, ou o centro da tela descontando metade do tamanho.
    const placeAt = (args: Args, size: { width: number; height: number }): XYPosition => {
      const x = num(args.x)
      const y = num(args.y)
      if (x !== undefined && y !== undefined) return { x, y }
      const c = screenCenter()
      return { x: x ?? c.x - size.width / 2, y: y ?? c.y - size.height / 2 }
    }

    const tools: Record<string, (args: Args) => Promise<string> | string> = {
      ver_canvas: () => {
        const nodes = nodesRef.current
        const topLeft = latest.current.screenToFlowPosition({ x: 0, y: 0 })
        const bottomRight = latest.current.screenToFlowPosition({ x: window.innerWidth, y: window.innerHeight })
        const blocos = nodes.map((n) => {
          const p = absolute(n, nodes)
          const s = sizeOf(n)
          const parent = n.parentId ? nodes.find((g) => g.id === n.parentId) : undefined
          return {
            id: n.id,
            tipo: kindOf(n),
            nome: nameOf(n),
            ...(n.type !== 'area' && { caminho: n.data.path }),
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
      },

      mover: (args) => {
        const items = (args.itens as { id: string; x: number; y: number }[]) ?? []
        let next = nodesRef.current
        const moved: string[] = []
        for (const item of items) {
          const node = find(next, item.id)
          const parent = node.parentId ? next.find((g) => g.id === node.parentId) : undefined
          const position = parent ? { x: item.x - parent.position.x, y: item.y - parent.position.y } : { x: item.x, y: item.y }
          next = next.map((n) => (n.id === node.id ? ({ ...n, position } as CanvasNode) : n))
          moved.push(node.id)
        }
        apply(growGroupsToFit(next, moved))
        return `${moved.length} bloco(s) movido(s).`
      },

      organizar_em_grade: (args) => {
        const nodes = nodesRef.current
        const list = ((args.ids as string[]) ?? []).map((ref) => find(nodes, ref))
        const parentId = list[0]?.parentId
        if (list.some((n) => n.parentId !== parentId)) throw new ToolError('Os blocos precisam estar no mesmo grupo, ou todos soltos.')
        const cols = num(args.colunas) ?? list.length
        const first = list[0]
        // Trabalha com a caixa visível (pasta conta os botões de cima).
        const start = parentId
          ? { x: GROUP_PADDING, y: GROUP_PADDING }
          : { x: num(args.x) ?? first.position.x, y: num(args.y) ?? first.position.y - outsetTop(first) }
        const positions = new Map<string, XYPosition>()
        let y = start.y
        for (let row = 0; row * cols < list.length; row++) {
          const items = list.slice(row * cols, row * cols + cols)
          let x = start.x
          let rowHeight = 0
          for (const n of items) {
            const s = sizeOf(n)
            positions.set(n.id, { x, y: y + outsetTop(n) })
            x += s.width + GAP
            rowHeight = Math.max(rowHeight, s.height + outsetTop(n))
          }
          y += rowHeight + GAP
        }
        let next = nodes.map((n) => (positions.has(n.id) ? ({ ...n, position: positions.get(n.id)! } as CanvasNode) : n))
        if (parentId) next = fitGroupToContent(next, parentId)
        apply(next)
        return `${list.length} bloco(s) organizados em ${Math.ceil(list.length / cols)} linha(s).`
      },

      criar_grupo: (args) => {
        const size = { width: num(args.largura) ?? 480, height: num(args.altura) ?? 320 }
        const base = createGroup(placeAt(args, size))
        const group = {
          ...base,
          ...size,
          style: { ...base.style, ...size },
          data: { ...base.data, label: String(args.nome || base.data.label), color: String(args.cor || base.data.color) }
        }
        apply(addNode(nodesRef.current, group))
        return `Grupo criado: ${group.id}`
      },

      adicionar_pasta: async (args) => {
        const folder = args.caminho ? String(args.caminho) : await window.api.pickFolder()
        if (!folder) throw new ToolError('A pessoa fechou o seletor sem escolher pasta.')
        const nodes = nodesRef.current
        const groupId = args.grupo_id ? findGroup(nodes, args.grupo_id).id : undefined
        const node = createFolderInstance(placeAt(args, { width: 400, height: 130 }), folder)
        apply(addNode(nodes, node, groupId))
        return `Pasta adicionada: ${node.id} (${node.data.path})`
      },

      abrir_terminal: (args) => {
        const nodes = nodesRef.current
        const groupId = args.grupo_id ? findGroup(nodes, args.grupo_id).id : undefined
        const node = createTerminal(placeAt(args, { width: 620, height: 380 }), String(args.caminho))
        apply(addNode(nodes, node, groupId))
        return `Terminal aberto: ${node.id}`
      },

      mover_para_grupo: (args) => {
        const nodes = nodesRef.current
        const node = find(nodes, args.id)
        if (node.type === 'area') throw new ToolError('Grupo não entra em outro grupo.')
        const groupId = args.grupo_id ? findGroup(nodes, args.grupo_id).id : null
        apply(moveToGroup(nodes, node.id, groupId))
        return groupId ? 'Movido para o grupo.' : 'Tirado do grupo.'
      },

      renomear: (args) => {
        const node = find(nodesRef.current, args.id)
        apply(rename(nodesRef.current, node.id, String(args.nome)))
        return 'Renomeado.'
      },

      excluir: (args) => {
        const nodes = nodesRef.current
        const node = find(nodes, args.id)
        if (node.type === 'area') {
          const keep = !!args.manter_conteudo
          // Terminais que somem com o grupo não ficam rodando escondidos.
          if (!keep) nodes.filter((n) => n.parentId === node.id && n.type === 'terminal').forEach((t) => window.api.terminal.kill(t.id))
          apply(keep ? ungroup(nodes, node.id) : removeGroup(nodes, node.id))
          return keep ? 'Grupo excluído; o conteúdo ficou solto no canvas.' : 'Grupo excluído com o que tinha dentro.'
        }
        if (node.type === 'terminal') window.api.terminal.kill(node.id)
        apply(removeNode(nodes, node.id))
        return `${kindOf(node)} excluído.`
      },

      recolher_grupo: (args) => {
        const group = findGroup(nodesRef.current, args.id)
        const want = !!args.recolhido
        if (group.type === 'area' && !!group.data.collapsed !== want) apply(toggleCollapse(nodesRef.current, group.id))
        return want ? 'Grupo recolhido.' : 'Grupo expandido.'
      },

      cor_do_grupo: (args) => {
        const group = findGroup(nodesRef.current, args.id)
        apply(setGroupColor(nodesRef.current, group.id, String(args.cor)))
        return 'Cor alterada.'
      },

      ajustar_grupo: (args) => {
        const group = findGroup(nodesRef.current, args.id)
        apply(fitGroupToContent(nodesRef.current, group.id))
        return 'Grupo ajustado ao conteúdo.'
      },

      focar: (args) => {
        const ids = ((args.ids as string[]) ?? []).map((ref) => find(nodesRef.current, ref).id)
        // Espera a tela desenhar o que acabou de mudar.
        setTimeout(
          () =>
            latest.current.fitView({ padding: 0.2, duration: 300, maxZoom: 1, ...(ids.length && { nodes: ids.map((id) => ({ id })) }) }),
          50
        )
        return 'Visão ajustada.'
      }
    }

    return window.api.canvasAgent.onCall(async (call: CanvasToolCall) => {
      const run = tools[call.name]
      try {
        if (!run) throw new ToolError(`Ação desconhecida: ${call.name}`)
        window.api.canvasAgent.respond({ id: call.id, text: await run(call.args) })
      } catch (err) {
        const text = err instanceof ToolError ? err.message : `Erro: ${(err as Error).message}`
        window.api.canvasAgent.respond({ id: call.id, text, error: true })
      }
    })
  }, [nodesRef])
}
