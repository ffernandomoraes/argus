import type { Node } from '@xyflow/react'

export type SessionStatus = 'idle' | 'running' | 'needs-you' | 'done'

export type AreaData = {
  label: string
  color: string
  // Conta do Claude das pastas, terminais e conversas de dentro. Sem ela (ou removida), a padrão.
  account?: string
  collapsed?: boolean
  // Conteúdo oculto: as instâncias de dentro somem e o grupo vira uma área listrada (como no FigJam).
  obscured?: boolean
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
  // Recolhida: embaixo da pasta ficam só as conversas rodando ou esperando você.
  collapsed?: boolean
}

// Terminal solto no canvas: o `claude` ou o shell do sistema, numa pasta.
export type TerminalKind = 'claude' | 'shell'

export type TerminalData = {
  name: string
  path: string
  // Sem kind = claude (terminais salvos antes de existir o shell).
  kind?: TerminalKind
  // Conversa que ele retoma; vazio = conversa nova.
  sessionId?: string
}

// Conversa sem projeto: roda na pasta do usuário e entra no canvas no primeiro envio,
// como um card que reabre a conversa no painel lateral.
export type ChatData = {
  // Nome de reserva enquanto o Claude Code não deu título à conversa.
  name: string
  path: string
  sessionId: string
}

// Conversa aberta dentro do canvas, como o terminal: o mesmo chat do painel lateral, num bloco
// que acompanha o zoom e fica onde foi posto. Nasce ao lado da pasta (ou do card da conversa solta).
export type ChatPanelData = {
  // Nome de reserva enquanto a conversa não aparece na lista da pasta.
  name: string
  path: string
  // Nome da pasta, para o cabeçalho; sem ele, é conversa sem projeto.
  projectName?: string
  sessionId: string
}

export type AreaNode = Node<AreaData, 'area'>
export type ProjectNode = Node<ProjectData, 'project'>
export type TerminalNode = Node<TerminalData, 'terminal'>
export type ChatNode = Node<ChatData, 'chat'>
// 'chatPanel', e não 'conversation': esse nome ficou com um teste antigo que não volta (persistence).
export type ChatPanelNode = Node<ChatPanelData, 'chatPanel'>
export type CanvasNode = AreaNode | ProjectNode | TerminalNode | ChatNode | ChatPanelNode
