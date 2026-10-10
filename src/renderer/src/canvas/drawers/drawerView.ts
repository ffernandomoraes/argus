import type { ActiveConversation, ActiveDesign } from '../CanvasContext'
import { looseProject } from '../factory'
import { groupAccount } from '../operations'
import type { CanvasNode, ConversationSummary, ProjectData } from '../types'

// Pasta em que a conversa do bloco roda: a do projeto ou, na conversa solta, a do usuário.
export function projectOf(node: CanvasNode | undefined): ProjectData | null {
  if (node?.type === 'project') return node.data
  if (node?.type === 'chat') return looseProject()
  if (node?.type === 'chatPanel') return { name: node.data.projectName ?? 'Sem projeto', path: node.data.path, color: '#71717a' }
  return null
}

// Tom do grupo que contém o bloco: o drawer puxa essa cor de leve.
function tintOf(nodes: CanvasNode[], parentId: string | undefined): string | undefined {
  const group = parentId ? nodes.find((n) => n.id === parentId) : undefined
  return group?.type === 'area' ? group.data.color : undefined
}

// De onde a conversa de um drawer abriu e onde ela roda, com a conta e a cor do grupo.
export type SlotTarget = {
  nodeId?: string
  parentId?: string
  project: ProjectData
  loose: boolean
  account?: string
  tint?: string
}

// Conversa sem projeto ainda não enviada não tem bloco: roda na pasta do usuário. Nulo se a pasta
// (ou o card) saiu do canvas: o drawer some sozinho.
export function slotTarget(nodes: CanvasNode[], active: ActiveConversation | null): SlotTarget | null {
  if (!active) return null
  const node = nodes.find((n) => n.id === active.nodeId)
  const loose = node ? node.type === 'chat' : active.nodeId === null
  const project = node ? projectOf(node) : loose ? looseProject() : null
  if (!project) return null
  return {
    nodeId: node?.id,
    parentId: node?.parentId,
    project,
    loose,
    // Conta do grupo da pasta (ou do card da conversa solta); fora de grupo, a padrão.
    account: groupAccount(nodes, node),
    tint: tintOf(nodes, node?.parentId)
  }
}

// Mesmo lugar, mesma pasta, mesma conta e cor: a lista de nós muda a cada quadro de um arraste, e o
// drawer não precisa redesenhar por isso.
export function sameTarget(a: SlotTarget, b: SlotTarget): boolean {
  return (
    a.nodeId === b.nodeId &&
    a.parentId === b.parentId &&
    a.loose === b.loose &&
    a.account === b.account &&
    a.tint === b.tint &&
    a.project.name === b.project.name &&
    a.project.path === b.project.path &&
    a.project.color === b.project.color
  )
}

// Conversa nova, ainda fora da lista da pasta. Sem mensagem, a hora não aparece em lugar nenhum:
// ela só faz o histórico ser relido quando muda, e uma conversa nova não tem histórico.
export function draftConversation(active: ActiveConversation): ConversationSummary {
  return {
    id: active.conversationId,
    title: 'Nova conversa',
    kind: 'conversa',
    status: 'idle',
    updatedAt: '',
    contextPercent: 0,
    sessionId: active.sessionId,
    draft: true
  }
}

// A conversa do drawer. A nova, que já entrou na lista da pasta, passa a ser a conversa normal;
// antes disso, a de rascunho. Nenhuma: saiu da lista (foi excluída).
export function conversationOf(
  active: ActiveConversation,
  sessions: ConversationSummary[],
  draft: ConversationSummary | null
): ConversationSummary | undefined {
  const started = active.sessionId ? sessions.find((c) => c.id === active.sessionId) : undefined
  return started ?? draft ?? sessions.find((c) => c.id === active.conversationId)
}

// Design aberto no drawer: um da pasta. Some se a pasta sair do canvas.
export type DesignView = { designId: string; projectPath: string; projectName: string; account?: string; tint?: string }

export function designView(nodes: CanvasNode[], design: ActiveDesign | null): DesignView | null {
  if (!design) return null
  const node = nodes.find((n) => n.id === design.nodeId)
  if (node?.type !== 'project') return null
  return {
    designId: design.designId,
    projectPath: node.data.path,
    projectName: node.data.name,
    account: groupAccount(nodes, node),
    tint: tintOf(nodes, node.parentId)
  }
}
