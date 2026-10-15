import { memo, useCallback, useMemo } from 'react'
import type { MemoryProject } from '../../../../shared/memory'
import { AgentsModal } from '../../agents/AgentsModal'
import { DevServersModal } from '../../devServers/DevServersModal'
import { MemoryModal } from '../../memory/MemoryModal'
import { Presence } from '../../motion'
import type { Change } from '../actions/types'
import { AllConversationsPanel } from '../AllConversationsPanel'
import { CommandBar } from '../CommandBar'
import { ConfirmDialog } from '../ConfirmDialog'
import { ContextMenu } from '../ContextMenu'
import { createFolderInstance, createWorkspace, displayPath } from '../factory'
import { FolderPicker } from '../FolderPicker'
import { addNode } from '../operations'
import type { ProjectNode } from '../types'
import type { OverlayCommands, OverlayState } from './useOverlays'
import { tr } from '../../i18n'

type Props = {
  state: OverlayState
  commands: OverlayCommands
  // Pastas do canvas (useCanvasProjects): mesma lista enquanto nomes e caminhos não mudam.
  projects: MemoryProject[]
  // Pasta do painel com todas as conversas; nula se ela saiu do canvas (o painel some junto).
  allConversations: ProjectNode | null
  // Pasta da conversa aberta: a memória começa mostrando a dela.
  memoryProject?: string
  openConversation: (nodeId: string, conversationId: string) => void
  newConversation: (nodeId: string) => void
  change: Change
}

// Painéis e modais por cima do canvas: todas as conversas de uma pasta, memória, agentes,
// servidores, "Nova pasta", o menu de botão direito, a confirmação e a barra de comando.
function CanvasOverlaysView(props: Props) {
  const { state, commands, projects, allConversations, change, openConversation, newConversation } = props
  const paths = useMemo(() => projects.map((p) => p.path), [projects])
  const onCanvas = useMemo(() => new Set(paths), [paths])
  const listId = allConversations?.id

  // A lista continua aberta: a conversa abre no drawer ao lado dela.
  const openFromList = useCallback(
    (conversationId: string) => {
      if (listId) openConversation(listId, conversationId)
    },
    [listId, openConversation]
  )
  const newFromList = useCallback(() => {
    if (listId) newConversation(listId)
  }, [listId, newConversation])

  // Dentro de um grupo, a pasta entra num lugar livre e o grupo cresce se precisar.
  const { folderPicker } = state
  const pickFolder = useCallback(
    (folder: string) => {
      if (!folderPicker) return
      const node = createFolderInstance(folderPicker.position, folder)
      change((ns) => addNode(ns, node, folderPicker.groupId))
      commands.closeFolderPicker()
    },
    [folderPicker, change, commands]
  )
  const pickWorkspace = useCallback(
    async (folders: string[]) => {
      if (!folderPicker) return
      const dir = await window.api.syncWorkspace(folders.map(displayPath)).catch((err: Error) => {
        commands.confirm({ title: tr('Não deu para criar o espaço de trabalho', 'Couldn’t create the workspace'), description: err.message })
        return null
      })
      if (!dir) return
      const node = createWorkspace(folderPicker.position, folders, dir)
      change((ns) => addNode(ns, node, folderPicker.groupId))
      commands.closeFolderPicker()
    },
    [folderPicker, change, commands]
  )

  return (
    <>
      {/* Depois do drawer: no mesmo nível, se um encostar no outro, a lista fica por cima. */}
      <Presence>
        {allConversations && (
          <AllConversationsPanel
            project={allConversations.data}
            nodeId={allConversations.id}
            rect={state.allConversationsRect}
            onRectChange={commands.setAllConversationsRect}
            onOpen={openFromList}
            onNew={newFromList}
            onClose={commands.closeAllConversations}
          />
        )}
      </Presence>
      <Presence kind="modal">
        {state.memory && (
          <MemoryModal
            projects={projects}
            only={state.memory === 'all' ? undefined : state.memory}
            initialProject={props.memoryProject}
            onClose={commands.closeMemory}
          />
        )}
      </Presence>
      <Presence kind="modal">{state.agents && <AgentsModal onClose={commands.closeAgents} />}</Presence>
      <Presence kind="modal">
        {state.devServers && <DevServersModal paths={paths} onClose={commands.closeDevServers} />}
      </Presence>
      <Presence kind="modal">
        {folderPicker && (
          <FolderPicker
            onCanvas={onCanvas}
            onPick={pickFolder}
            onPickMany={folderPicker.workspace ? pickWorkspace : undefined}
            onClose={commands.closeFolderPicker}
          />
        )}
      </Presence>
      <Presence kind="menu">{state.menu && <ContextMenu menu={state.menu} onClose={commands.closeMenu} />}</Presence>
      <Presence kind="modal">
        {state.confirm && <ConfirmDialog request={state.confirm} onClose={commands.closeConfirm} />}
      </Presence>
      <Presence kind="modal">
        {state.commandBar && <CommandBar voice={state.commandBar.voice} onClose={commands.closeCommandBar} />}
      </Presence>
    </>
  )
}

export const CanvasOverlays = memo(CanvasOverlaysView)
