import { memo, useCallback, useLayoutEffect } from 'react'
import type { PanelRect } from '../../conversation/FloatingPanel'
import { TasksDrawer } from '../../conversation/TasksDrawer'
import type { TasksRef } from '../CanvasContext'
import type { SlotId } from './drawerState'
import type { SlotTarget } from './drawerView'
import type { DrawerCommands } from './useDrawers'
import { tr } from '../../i18n'

type Props = {
  slot: SlotId
  tasks: TasksRef
  target: SlotTarget
  rect: PanelRect | null
  obstacles: readonly PanelRect[]
  pinned: boolean
  commands: DrawerCommands
  onShown: (slot: SlotId, title: string | null) => void
}

// Um drawer com a saída das tarefas em segundo plano de uma conversa, no lugar dela (ver TasksDrawer).
export const TasksSlot = memo(function TasksSlot({ slot, tasks, target, rect, obstacles, pinned, commands, onShown }: Props) {
  const title = tr('Tarefas em segundo plano', 'Background tasks')
  useLayoutEffect(() => {
    onShown(slot, title)
  }, [onShown, slot, title])
  useLayoutEffect(() => () => onShown(slot, null), [onShown, slot])

  const { nodeId } = target
  const parent = tasks.sessionId
  const onRectChange = useCallback((next: PanelRect) => commands.setRect(slot, next), [commands, slot])
  const onTogglePin = useCallback(() => commands.togglePin(slot), [commands, slot])
  const onClose = useCallback(() => commands.close(slot), [commands, slot])
  const onBack = useCallback(
    () => commands.replace(slot, { nodeId: nodeId ?? null, conversationId: parent }),
    [commands, slot, nodeId, parent]
  )

  return (
    <TasksDrawer
      project={target.project}
      tint={target.tint}
      tasks={tasks}
      rect={rect}
      obstacles={obstacles}
      onRectChange={onRectChange}
      pinned={pinned}
      onTogglePin={onTogglePin}
      onBack={onBack}
      onClose={onClose}
    />
  )
})
