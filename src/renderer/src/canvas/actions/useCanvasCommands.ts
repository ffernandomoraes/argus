import type { MouseEvent as ReactMouseEvent } from 'react'
import { useStableCommands } from '../../lib/useStableCommands'
import type { CanvasActions } from '../CanvasContext'
import type { OverlayCommands } from '../drawers/useOverlays'
import type { ConversationSummary } from '../types'
import type { useConversationActions } from './useConversationActions'
import type { useNodeActions } from './useNodeActions'

type Parts = {
  nodeActions: ReturnType<typeof useNodeActions>
  conversations: ReturnType<typeof useConversationActions>
  overlays: OverlayCommands
  openConversationMenu: (e: ReactMouseEvent, nodeId: string, conversation: ConversationSummary) => void
  openSettings: () => void
}

// O valor do CanvasContext: só os comandos, num objeto criado uma vez (useStableCommands). O
// estado que os blocos mostram fica no store do canvasView, lido por bloco.
export function useCanvasCommands({ nodeActions, conversations, overlays, openConversationMenu, openSettings }: Parts): CanvasActions {
  return useStableCommands<CanvasActions>({
    ...nodeActions,
    addFolder: overlays.addFolder,
    openConversation: conversations.openConversation,
    newConversation: conversations.newConversation,
    newLooseConversation: conversations.newLooseConversation,
    openDesign: conversations.openDesign,
    closeChatPanel: conversations.closeChatPanel,
    chatPanelToDrawer: conversations.chatPanelToDrawer,
    chatPanelPopout: conversations.chatPanelPopout,
    openFileFrom: conversations.openFileFrom,
    openConversationMenu,
    openAllConversations: overlays.openAllConversations,
    openSettings,
    openMemory: overlays.openMemory,
    openAgents: overlays.openAgents,
    openDevServers: overlays.openDevServers
  })
}
