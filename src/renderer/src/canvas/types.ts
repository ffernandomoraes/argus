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
  // design: uma conversa do modo design (o drawer de design, não o chat).
  kind: 'conversa' | 'agente' | 'design'
  status: SessionStatus
  // Última mensagem, em ISO. Ordena a lista e mostra "há 2h".
  updatedAt: string
  // Quanto da janela de contexto a conversa já ocupa, de 0 a 100.
  contextPercent: number
  // Sessão do Claude Code; com ela o terminal retoma a conversa (`claude --resume`).
  sessionId?: string
  // Conversa nova, ainda sem mensagem enviada: abre em branco e não aparece na lista.
  draft?: boolean
  // Conversa de um protótipo do modo design: leva o ícone do design na lista.
  design?: boolean
  // Item do modo design: o design que ele abre.
  designId?: string
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

type TerminalData = {
  name: string
  path: string
  // Sem kind = claude (terminais salvos antes de existir o shell).
  kind?: TerminalKind
  // Conversa que ele retoma; vazio = conversa nova.
  sessionId?: string
}

// Conversa sem projeto: roda na pasta do usuário e entra no canvas no primeiro envio,
// como um card que reabre a conversa no painel lateral.
type ChatData = {
  // Nome de reserva enquanto o Claude Code não deu título à conversa.
  name: string
  path: string
  sessionId: string
}

// Conversa aberta dentro do canvas, como o terminal: o mesmo chat do painel lateral, num bloco
// que acompanha o zoom e fica onde foi posto. Nasce ao lado da pasta (ou do card da conversa solta).
type ChatPanelData = {
  // Nome de reserva enquanto a conversa não aparece na lista da pasta.
  name: string
  path: string
  // Nome da pasta, para o cabeçalho; sem ele, é conversa sem projeto.
  projectName?: string
  sessionId: string
}

// Nota solta no canvas: um lembrete em texto ("testar o login depois"), sem pasta nem sessão.
// Posta em cima de um grupo, entra nele e anda junto; em cima de uma pasta, só fica ali.
// Como o comentário do Figma: nasce pequena, alarga com o texto até NOTE_MAX_WIDTH e depois
// cresce para baixo. `width`: largura escolhida pela pessoa no puxador; a altura segue o texto.
type NoteData = {
  text: string
  color: string
  width?: number
}

export type AreaNode = Node<AreaData, 'area'>
export type ProjectNode = Node<ProjectData, 'project'>
export type TerminalNode = Node<TerminalData, 'terminal'>
export type ChatNode = Node<ChatData, 'chat'>
// 'chatPanel', e não 'conversation': esse nome ficou com um teste antigo que não volta (o filtro
// dos tipos antigos fica em flow/savedNodes.ts).
export type ChatPanelNode = Node<ChatPanelData, 'chatPanel'>
export type NoteNode = Node<NoteData, 'note'>
export type CanvasNode = AreaNode | ProjectNode | TerminalNode | ChatNode | ChatPanelNode | NoteNode
