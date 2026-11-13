import type { CanvasNode, ProjectNode } from '../types'

// Conversas do grupo (ProjectData.groupWide): um workspace cujas pastas são as dos cards do grupo.
// O grupo já junta as pastas; este card só dá a elas uma conversa em comum.

const isProject = (n: CanvasNode): n is ProjectNode => n.type === 'project'

export const isGroupWide = (n: CanvasNode | undefined): n is ProjectNode => !!n && isProject(n) && !!n.data.groupWide

export function groupWideOf(nodes: CanvasNode[], groupId: string): ProjectNode | undefined {
  return nodes.find((n): n is ProjectNode => isGroupWide(n) && n.parentId === groupId)
}

// Pastas que as conversas do grupo enxergam: cada pasta do grupo, as tarefas isoladas delas (que
// moram no mesmo grupo, ou ligadas a uma pasta dele) e as pastas de um espaço de trabalho antigo
// posto no grupo. `current` mantém a ordem de antes: pasta nova entra no fim, e a lista só muda
// quando muda de verdade (mudar reinicia as conversas abertas).
export function groupFolders(nodes: CanvasNode[], groupId: string, current: string[] = []): string[] {
  const inGroup = nodes.filter((n): n is ProjectNode => isProject(n) && !n.data.groupWide && n.parentId === groupId)
  const ids = new Set(inGroup.map((n) => n.id))
  const tasks = nodes.filter((n): n is ProjectNode => isProject(n) && !!n.data.worktree && ids.has(n.data.worktree.of) && !ids.has(n.id))
  const found = new Set([...inGroup, ...tasks].flatMap((n) => n.data.folders ?? [n.data.path]))
  return [...current.filter((f) => found.has(f)), ...[...found].filter((f) => !current.includes(f))]
}

// Lista nova no card e nos blocos abertos dele (conversa no canvas e terminal guardam uma cópia
// das pastas ao nascer).
export function setGroupWideFolders(nodes: CanvasNode[], id: string, folders: string[]): CanvasNode[] {
  const card = nodes.find((n) => n.id === id)
  if (!isGroupWide(card)) return nodes
  const path = card.data.path
  return nodes.map((n): CanvasNode => {
    if (n.id === id) return { ...card, data: { ...card.data, folders } }
    if ((n.type === 'chatPanel' || n.type === 'terminal') && n.data.path === path && n.data.folders) return { ...n, data: { ...n.data, folders } } as CanvasNode
    return n
  })
}
