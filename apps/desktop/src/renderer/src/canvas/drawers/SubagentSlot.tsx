import { memo, useCallback, useLayoutEffect } from 'react'
import type { PanelRect } from '../../conversation/FloatingPanel'
import type { LineRange } from '../../conversation/fileLinks'
import { SubagentDrawer } from '../../conversation/SubagentDrawer'
import type { SubagentRef } from '../CanvasContext'
import { codeProject } from './codeProject'
import type { SlotId } from './drawerState'
import type { SlotTarget } from './drawerView'
import type { SlotActions } from './DrawerSlot'
import type { DrawerCommands } from './useDrawers'

type Props = {
  slot: SlotId
  subagent: SubagentRef
  target: SlotTarget
  rect: PanelRect | null
  obstacles: readonly PanelRect[]
  pinned: boolean
  commands: DrawerCommands
  actions: SlotActions
  onShown: (slot: SlotId, title: string | null) => void
}

// Um drawer com o histórico de um subagente, no lugar de uma conversa (ver SubagentDrawer). Não
// depende da lista de conversas da pasta: o subagente não está nela.
export const SubagentSlot = memo(function SubagentSlot({ slot, subagent, target, rect, obstacles, pinned, commands, actions, onShown }: Props) {
  const title = `${subagent.agent} - ${subagent.description}`
  useLayoutEffect(() => {
    onShown(slot, title)
  }, [onShown, slot, title])
  useLayoutEffect(() => () => onShown(slot, null), [onShown, slot])

  const { project, nodeId } = target
  const onRectChange = useCallback((next: PanelRect) => commands.setRect(slot, next), [commands, slot])
  const onTogglePin = useCallback(() => commands.togglePin(slot), [commands, slot])
  const onClose = useCallback(() => commands.close(slot), [commands, slot])
  const parent = subagent.sessionId
  const onBack = useCallback(
    () => commands.replace(slot, { nodeId: nodeId ?? null, conversationId: parent }),
    [commands, slot, nodeId, parent]
  )
  const onOpenSubagent = useCallback((next: SubagentRef) => actions.openSubagent(nodeId ?? null, project.path, next), [actions, nodeId, project.path])
  const onOpenFile = useCallback(
    (path: string, lines?: LineRange) => {
      const code = codeProject(project, path)
      commands.openFile({ slot, ...(code !== project && { project: code }) }, code.path, path, lines)
    },
    [commands, slot, project]
  )

  return (
    <SubagentDrawer
      project={project}
      tint={target.tint}
      subagent={subagent}
      rect={rect}
      obstacles={obstacles}
      onRectChange={onRectChange}
      pinned={pinned}
      onTogglePin={onTogglePin}
      onBack={onBack}
      onOpenSubagent={onOpenSubagent}
      onOpenFile={onOpenFile}
      onClose={onClose}
    />
  )
})
