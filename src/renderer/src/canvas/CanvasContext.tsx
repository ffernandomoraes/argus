import { createContext, useContext } from 'react'
import type { XYPosition } from '@xyflow/react'
import type { TerminalKind } from './types'

// draft: conversa nova, que ainda não existe na lista da pasta.
// sessionId: id que o Claude deu à conversa nova no primeiro envio.
// nodeId nulo: conversa sem projeto que ainda não foi enviada; `at` é onde o botão direito foi dado.
export type ActiveConversation = {
  nodeId: string | null
  conversationId: string
  draft?: boolean
  sessionId?: string
  at?: XYPosition
}

type CanvasActions = {
  renamingId: string | null
  startRename: (id: string) => void
  finishRename: (id: string, value: string | null) => void
  addGroup: (position: XYPosition) => void
  addFolder: (position: XYPosition, groupId?: string) => void
  toggleGroup: (id: string) => void
  activeConversation: ActiveConversation | null
  openConversation: (nodeId: string, conversationId: string) => void
  newConversation: (nodeId: string) => void
  // Conversa sem projeto: abre o painel em branco e só entra no canvas no primeiro envio.
  // Sem posição, o card procura sozinho um lugar livre.
  newLooseConversation: (position?: XYPosition) => void
  // Painel flutuante com todas as conversas da pasta.
  openAllConversations: (nodeId: string) => void
  openSettings: () => void
  openMemory: () => void
  // Biblioteca de agentes globais.
  openAgents: () => void
  // Servidores locais que o Claude Code deixou rodando.
  openDevServers: () => void
  // Barra de comando do assistente do canvas; voice = abre já ouvindo.
  addTerminal: (position: XYPosition, groupId?: string, folder?: string, kind?: TerminalKind) => void
  // Guarda no nó a conversa que o terminal criou, para ele retomá-la depois.
  bindTerminalSession: (nodeId: string, sessionId: string) => void
  closeTerminal: (nodeId: string, name: string) => void
  // Conversas abertas em janela separada.
  poppedOut: Set<string>
}

export const CanvasContext = createContext<CanvasActions | null>(null)

export function useCanvasActions(): CanvasActions {
  const ctx = useContext(CanvasContext)
  if (!ctx) throw new Error('useCanvasActions fora do Canvas')
  return ctx
}
