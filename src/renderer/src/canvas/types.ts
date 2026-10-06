import type { Node } from '@xyflow/react'

export type SessionStatus = 'idle' | 'running' | 'needs-you' | 'done'

export type AreaData = {
  label: string
  color: string
  collapsed?: boolean
  // Tamanho antes de recolher, para voltar igual ao expandir.
  expandedSize?: { width: number; height: number }
}

export type ConversationSummary = {
  id: string
  title: string
  kind: 'conversa' | 'agente'
  status: SessionStatus
  // Última mensagem, em ISO. Ordena a lista e mostra "há 2h".
  updatedAt: string
  // Quanto da janela de contexto a conversa já ocupa, de 0 a 100.
  contextPercent: number
  // Sessão do Claude Code; com ela o terminal retoma a conversa (`claude --resume`).
  sessionId?: string
  // Conversa nova, ainda sem mensagem enviada: abre em branco e não aparece na lista.
  draft?: boolean
}

export type ProjectData = {
  name: string
  path: string
  color: string
}

// Terminal solto no canvas, rodando o `claude` numa pasta.
export type TerminalData = {
  name: string
  path: string
  // Conversa que ele retoma; vazio = conversa nova.
  sessionId?: string
}

export type AreaNode = Node<AreaData, 'area'>
export type ProjectNode = Node<ProjectData, 'project'>
export type TerminalNode = Node<TerminalData, 'terminal'>
export type CanvasNode = AreaNode | ProjectNode | TerminalNode
