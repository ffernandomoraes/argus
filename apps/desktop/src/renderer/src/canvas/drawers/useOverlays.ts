import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import type { XYPosition } from '@xyflow/react'
import type { PanelRect } from '../../conversation/FloatingPanel'
import type { ConfirmRequest } from '../ConfirmDialog'
import type { MenuState } from '../ContextMenu'

// "Nova pasta" aberto: onde a pasta entra e, se veio de um grupo, em qual.
type FolderPickerState = { position: XYPosition; groupId?: string }

export type OverlayState = {
  menu: MenuState | null
  confirm: ConfirmRequest | null
  // 'all' = todas as pastas; caminho = só a memória daquela pasta.
  memory: 'all' | string | null
  agents: boolean
  devServers: boolean
  // Barra de comando do assistente; voice = abriu já ouvindo.
  commandBar: { voice: boolean } | null
  folderPicker: FolderPickerState | null
  // Pasta (id do bloco) do painel com todas as conversas: o card do canvas mostra só as recentes.
  allConversations: string | null
  allConversationsRect: PanelRect | null
}

export type OverlayCommands = {
  setMenu: Dispatch<SetStateAction<MenuState | null>>
  closeMenu: () => void
  confirm: (request: ConfirmRequest) => void
  closeConfirm: () => void
  openMemory: (projectPath?: string) => void
  closeMemory: () => void
  openAgents: () => void
  closeAgents: () => void
  openDevServers: () => void
  closeDevServers: () => void
  openCommandBar: () => void
  closeCommandBar: () => void
  addFolder: (position: XYPosition, groupId?: string) => void
  closeFolderPicker: () => void
  openAllConversations: (nodeId: string) => void
  closeAllConversations: () => void
  setAllConversationsRect: (rect: PanelRect) => void
}

// Painéis e modais por cima do canvas (CanvasOverlays): o que está aberto e como abrir e fechar,
// com identidade fixa para ir ao contexto e aos menus.
export function useOverlays(): { state: OverlayState; commands: OverlayCommands } {
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [memory, setMemory] = useState<'all' | string | null>(null)
  const [agents, setAgents] = useState(false)
  const [devServers, setDevServers] = useState(false)
  const [commandBar, setCommandBar] = useState<{ voice: boolean } | null>(null)
  const [folderPicker, setFolderPicker] = useState<FolderPickerState | null>(null)
  const [allConversations, setAllConversations] = useState<string | null>(null)
  const [allConversationsRect, setAllConversationsRect] = useState<PanelRect | null>(null)

  const state = useMemo(
    () => ({ menu, confirm, memory, agents, devServers, commandBar, folderPicker, allConversations, allConversationsRect }),
    [menu, confirm, memory, agents, devServers, commandBar, folderPicker, allConversations, allConversationsRect]
  )

  const commands = useMemo<OverlayCommands>(
    () => ({
      setMenu,
      closeMenu: () => setMenu(null),
      confirm: setConfirm,
      closeConfirm: () => setConfirm(null),
      openMemory: (projectPath) => setMemory(projectPath ?? 'all'),
      closeMemory: () => setMemory(null),
      openAgents: () => setAgents(true),
      closeAgents: () => setAgents(false),
      openDevServers: () => setDevServers(true),
      closeDevServers: () => setDevServers(false),
      // ⌘K abre para digitar; aberta, fica como está.
      openCommandBar: () => setCommandBar((c) => c ?? { voice: false }),
      closeCommandBar: () => setCommandBar(null),
      // A pasta é escolhida no FolderPicker (CanvasOverlays).
      addFolder: (position, groupId) => setFolderPicker({ position, groupId }),
      closeFolderPicker: () => setFolderPicker(null),
      openAllConversations: (nodeId) => setAllConversations(nodeId),
      closeAllConversations: () => setAllConversations(null),
      setAllConversationsRect
    }),
    []
  )

  return { state, commands }
}
