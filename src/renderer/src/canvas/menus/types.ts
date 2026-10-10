import type { Dispatch, SetStateAction } from 'react'
import type { XYPosition } from '@xyflow/react'
import type { AuthState } from '../../../../shared/auth'
import type { ConfirmRequest } from '../ConfirmDialog'
import type { CanvasNode, TerminalKind } from '../types'

// O que os menus do canvas podem fazer, vindo do Canvas. Cada menu declara só a parte que usa
// (Pick<Deps, ...>), e o Canvas passa o objeto inteiro.
export type Deps = {
  nodes: CanvasNode[]
  setNodes: Dispatch<SetStateAction<CanvasNode[]>>
  auth: AuthState | null
  confirm: (req: ConfirmRequest) => void
  startRename: (id: string) => void
  addGroup: (position: XYPosition) => void
  addFolder: (position: XYPosition, groupId?: string) => void
  addNote: (position: XYPosition, groupId?: string) => void
  // folder vazio = pasta do usuário.
  addTerminal: (position: XYPosition, groupId?: string, folder?: string, kind?: TerminalKind) => void
  closeTerminal: (nodeId: string, name: string) => void
  toggleGroup: (id: string) => void
  leaveGroup: (id: string) => void
  newConversation: (nodeId: string) => void
  newLooseConversation: (position?: XYPosition) => void
  openConversation: (nodeId: string, conversationId: string) => void
  closeChatPanel: (nodeId: string) => void
  chatPanelToDrawer: (nodeId: string) => void
  chatPanelPopout: (nodeId: string) => void
  // Conversa aberta em janela separada agora (lido na hora do clique).
  isPoppedOut: (conversationId: string) => boolean
  trashConversation: (path: string, conversationId: string) => void
  openDesign: (nodeId: string, designId?: string) => void
  organizeBoard: () => void
  organizeGroup: (id: string) => void
}
