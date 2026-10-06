import { createContext, useContext } from 'react'
import type { XYPosition } from '@xyflow/react'

// draft: conversa nova, que ainda não existe na lista da pasta.
// sessionId: id que o Claude deu à conversa nova no primeiro envio.
export type ActiveConversation = { nodeId: string; conversationId: string; draft?: boolean; sessionId?: string }

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
  // Painel flutuante com todas as conversas da pasta.
  openAllConversations: (nodeId: string) => void
  openSettings: () => void
  openMemory: () => void
  addTerminal: (position: XYPosition, groupId?: string, folder?: string, sessionId?: string, name?: string) => void
  recentConversations: (path: string) => { id: string; title: string }[]
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
