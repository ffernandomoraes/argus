import type { CanvasNode } from '../types'

// Bloco por onde a conversa abre: o card dela, se for solta, ou a pasta dela.
export function ownerOf(nodes: CanvasNode[], path: string, sessionId: string): CanvasNode | undefined {
  return (
    nodes.find((n) => n.type === 'chat' && n.data.sessionId === sessionId) ??
    nodes.find((n) => n.type === 'project' && n.data.path === path)
  )
}

// Conversa já posta no canvas (ChatPanelNode).
export function chatPanelOf(nodes: CanvasNode[], conversationId: string): CanvasNode | undefined {
  return nodes.find((n) => n.type === 'chatPanel' && n.data.sessionId === conversationId)
}
