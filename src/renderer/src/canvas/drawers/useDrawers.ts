import { useMemo, useReducer } from 'react'
import type { PanelRect } from '../../conversation/FloatingPanel'
import type { LineRange } from '../../conversation/fileLinks'
import type { ActiveConversation, ActiveDesign } from '../CanvasContext'
import type { ProjectData } from '../types'
import { drawerReducer, INITIAL_DRAWERS, type DrawerState, type SlotId } from './drawerState'
import { fileInFolder } from './fileInFolder'

// Comandos dos drawers, com identidade fixa: podem ir para o contexto, para os menus e para os
// drawers sem fazer ninguém redesenhar. Leem o estado atual pelo reducer, nunca o de um render velho.
export type DrawerCommands = {
  show: (conversation: ActiveConversation) => void
  closeAll: () => void
  close: (slot: SlotId) => void
  togglePin: () => void
  setRect: (slot: SlotId, rect: PanelRect) => void
  // Conversa nova (pelo id provisório) ganhou o id da sessão e, se era solta, o card no canvas.
  sessionStarted: (conversationId: string, sessionId: string, nodeId?: string) => void
  forget: (conversationId: string) => void
  // Fecha os drawers de conversa e abre o do design (nulo: só fecha).
  openDesign: (design: ActiveDesign | null) => void
  closeDesign: () => void
  toggleCode: (slot: SlotId) => void
  // Link de arquivo: abre o código da pasta `root` já com o arquivo. Pedido por um drawer (`slot`)
  // ou por uma conversa do canvas (`project`). Fora da pasta, o visualizador não tem acesso.
  openFile: (from: { slot?: SlotId; project?: ProjectData }, root: string, path: string, lines?: LineRange, diff?: boolean) => void
  // Arquivo escolhido, renomeado ou excluído na árvore do código.
  selectFile: (root: string, path: string) => void
  renamedFile: (root: string, from: string, to: string) => void
  deletedFile: (root: string, path: string) => void
  setFileDiff: (diff: boolean) => void
  closeFile: () => void
  closeCode: () => void
}

// Drawers de conversa (o principal e o segundo, com o fixado), o do design e o painel de código.
export function useDrawers(): { state: DrawerState; commands: DrawerCommands } {
  const [state, dispatch] = useReducer(drawerReducer, INITIAL_DRAWERS)

  const commands = useMemo<DrawerCommands>(
    () => ({
      show: (conversation) =>
        dispatch({ type: 'show', conversation, area: { width: window.innerWidth, height: window.innerHeight } }),
      closeAll: () => dispatch({ type: 'closeAll' }),
      close: (slot) => dispatch({ type: 'close', slot }),
      togglePin: () => dispatch({ type: 'togglePin' }),
      setRect: (slot, rect) => dispatch({ type: 'rect', slot, rect }),
      sessionStarted: (conversationId, sessionId, nodeId) =>
        dispatch({ type: 'sessionStarted', conversationId, sessionId, nodeId }),
      forget: (conversationId) => dispatch({ type: 'forget', conversationId }),
      openDesign: (design) => dispatch({ type: 'openDesign', design }),
      closeDesign: () => dispatch({ type: 'closeDesign' }),
      toggleCode: (slot) => dispatch({ type: 'toggleCode', slot }),
      openFile: (from, root, path, lines, diff) => {
        const rel = fileInFolder(root, path)
        dispatch({ type: 'openFile', ...from, file: rel ? { root, path: rel, lines, diff } : null })
      },
      selectFile: (root, path) => dispatch({ type: 'selectFile', root, path }),
      renamedFile: (root, from, to) => dispatch({ type: 'renamedFile', root, from, to }),
      deletedFile: (root, path) => dispatch({ type: 'deletedFile', root, path }),
      setFileDiff: (diff) => dispatch({ type: 'fileDiff', diff }),
      closeFile: () => dispatch({ type: 'closeFile' }),
      closeCode: () => dispatch({ type: 'closeCode' })
    }),
    []
  )

  return { state, commands }
}
