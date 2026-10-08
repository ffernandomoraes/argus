import { createContext, useContext, type MouseEvent as ReactMouseEvent } from 'react'
import type { XYPosition } from '@xyflow/react'
import type { LineRange } from '../conversation/fileLinks'
import type { ConversationSummary, ProjectData, TerminalKind } from './types'

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
  toggleObscure: (id: string) => void
  toggleProject: (id: string) => void
  // Grupo destacado: recebe o bloco solto que está sendo arrastado, se ele for largado agora.
  dropTargetId: string | null
  // "Tirar do grupo": o grupo encolhe, o bloco vai para fora e a câmera vai até ele.
  leaveGroup: (id: string) => void
  activeConversation: ActiveConversation | null
  openConversation: (nodeId: string, conversationId: string) => void
  newConversation: (nodeId: string) => void
  // Conversa sem projeto: abre o painel em branco e só entra no canvas no primeiro envio.
  // Sem posição, o card procura sozinho um lugar livre.
  newLooseConversation: (position?: XYPosition) => void
  // Botão direito numa conversa da lista da pasta: menu dela, não o da pasta.
  openConversationMenu: (e: ReactMouseEvent, nodeId: string, conversation: ConversationSummary) => void
  // Painel flutuante com todas as conversas da pasta.
  openAllConversations: (nodeId: string) => void
  openSettings: () => void
  // Com projectPath, mostra só a memória daquela pasta.
  openMemory: (projectPath?: string) => void
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
  // Conversa no canvas (ChatPanelNode): fechar tira o bloco (a conversa continua salva); os outros
  // dois tiram o bloco e abrem a conversa no painel lateral ou numa janela própria.
  closeChatPanel: (nodeId: string) => void
  chatPanelToDrawer: (nodeId: string) => void
  chatPanelPopout: (nodeId: string) => void
  // Link de arquivo clicado numa conversa do canvas: abre o código daquela pasta.
  openFileFrom: (project: ProjectData, path: string, lines?: LineRange, diff?: boolean) => void
}

export const CanvasContext = createContext<CanvasActions | null>(null)

export function useCanvasActions(): CanvasActions {
  const ctx = useContext(CanvasContext)
  if (!ctx) throw new Error('useCanvasActions fora do Canvas')
  return ctx
}
