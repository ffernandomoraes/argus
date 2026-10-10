import type { CanvasNode } from '../types'

// Mudanças nos dados de um bloco (nome, cor, texto, conta), sem mexer na posição.

export function removeNode(nodes: CanvasNode[], id: string): CanvasNode[] {
  return nodes.filter((n) => n.id !== id)
}

export function rename(nodes: CanvasNode[], id: string, name: string): CanvasNode[] {
  return nodes.map((n) => {
    if (n.id !== id) return n
    if (n.type === 'area') return { ...n, data: { ...n.data, label: name } }
    if (n.type === 'terminal') return { ...n, data: { ...n.data, name } }
    if (n.type === 'chat') return { ...n, data: { ...n.data, name } }
    if (n.type === 'chatPanel') return { ...n, data: { ...n.data, name } }
    if (n.type === 'note') return { ...n, data: { ...n.data, text: name } }
    return { ...n, data: { ...n.data, name } }
  })
}

export function setGroupColor(nodes: CanvasNode[], id: string, color: string): CanvasNode[] {
  return nodes.map((n) => (n.id === id && n.type === 'area' ? { ...n, data: { ...n.data, color } } : n))
}

export function setNoteText(nodes: CanvasNode[], id: string, text: string): CanvasNode[] {
  return nodes.map((n) => (n.id === id && n.type === 'note' ? { ...n, data: { ...n.data, text } } : n))
}

export function setNoteWidth(nodes: CanvasNode[], id: string, width: number): CanvasNode[] {
  return nodes.map((n) => (n.id === id && n.type === 'note' ? { ...n, data: { ...n.data, width } } : n))
}

export function setNoteColor(nodes: CanvasNode[], id: string, color: string): CanvasNode[] {
  return nodes.map((n) => (n.id === id && n.type === 'note' ? { ...n, data: { ...n.data, color } } : n))
}

export function setGroupAccount(nodes: CanvasNode[], id: string, account: string): CanvasNode[] {
  return nodes.map((n) => (n.id === id && n.type === 'area' ? { ...n, data: { ...n.data, account } } : n))
}

// Conta escolhida no grupo onde o bloco está; fora de grupo, nenhuma (vale a padrão).
export function groupAccount(nodes: CanvasNode[], node: CanvasNode | undefined): string | undefined {
  const group = node?.parentId ? nodes.find((n) => n.id === node.parentId) : undefined
  return group?.type === 'area' ? group.data.account : undefined
}
