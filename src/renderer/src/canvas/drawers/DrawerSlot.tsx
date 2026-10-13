import { memo, useCallback, useLayoutEffect } from 'react'
import { ConversationDrawer } from '../../conversation/ConversationDrawer'
import type { PanelRect } from '../../conversation/FloatingPanel'
import type { LineRange } from '../../conversation/fileLinks'
import type { ActiveConversation } from '../CanvasContext'
import type { ConversationSummary } from '../types'
import type { SlotId } from './drawerState'
import { sameTarget, type SlotTarget } from './drawerView'
import type { DrawerCommands } from './useDrawers'

// O que o drawer pede ao canvas (actions/useConversationActions).
export type SlotActions = {
  pinConversation: (nodeId: string, conversationId: string) => void
  popoutConversation: (nodeId: string, conversationId: string) => void
}

type Props = {
  slot: SlotId
  active: ActiveConversation
  // Decidida no DrawerHost (useSlotConversation): sem ela o drawer nem é montado.
  conversation: ConversationSummary
  target: SlotTarget
  rect: PanelRect | null
  // Rects dos outros drawers de conversa à vista.
  obstacles: readonly PanelRect[]
  pinned: boolean
  codeOpen: boolean
  commands: DrawerCommands
  actions: SlotActions
  // Avisa o Canvas do título da conversa à vista (nulo: nada na tela).
  onShown: (slot: SlotId, title: string | null) => void
}

// Um drawer de conversa, fixado ou solto. A conversa vem pronta do DrawerHost, que tira o
// drawer (com a saída animada) se ela sair da lista.
function DrawerSlotView(props: Props) {
  const { slot, active, conversation, target, rect, obstacles, pinned, codeOpen, commands, actions, onShown } = props
  const title = conversation.title

  useLayoutEffect(() => {
    onShown(slot, title)
  }, [onShown, slot, title])
  useLayoutEffect(() => () => onShown(slot, null), [onShown, slot])

  const root = target.project.path
  const { nodeId } = target
  const conversationId = conversation.id
  const onRectChange = useCallback((next: PanelRect) => commands.setRect(slot, next), [commands, slot])
  const onToggleCode = useCallback(() => commands.toggleCode(slot), [commands, slot])
  const onOpenFile = useCallback(
    (path: string, lines?: LineRange) => commands.openFile({ slot }, root, path, lines),
    [commands, slot, root]
  )
  const onOpenDiff = useCallback(
    (path: string) => commands.openFile({ slot }, root, path, undefined, true),
    [commands, slot, root]
  )
  // O card da conversa sem projeto não nasce aqui: o Canvas cria (actions/useLooseCards), mesmo
  // com o drawer já fechado.
  const draftId = active.conversationId
  const onSessionStarted = useCallback(
    (sessionId: string) => commands.sessionStarted(draftId, sessionId),
    [commands, draftId]
  )
  const onPopout = useCallback(() => {
    if (nodeId && conversationId) actions.popoutConversation(nodeId, conversationId)
    commands.close(slot)
  }, [actions, commands, slot, nodeId, conversationId])
  const onPinToCanvas = useCallback(() => {
    if (nodeId && conversationId) actions.pinConversation(nodeId, conversationId)
    commands.close(slot)
  }, [actions, commands, slot, nodeId, conversationId])
  const onClose = useCallback(() => commands.close(slot), [commands, slot])
  const onTogglePin = useCallback(() => commands.togglePin(slot), [commands, slot])

  return (
    <ConversationDrawer
      project={target.project}
      account={target.account}
      loose={target.loose}
      tint={target.tint}
      conversation={conversation}
      codeOpen={codeOpen}
      rect={rect}
      obstacles={obstacles}
      onRectChange={onRectChange}
      pinned={pinned}
      onTogglePin={onTogglePin}
      onToggleCode={onToggleCode}
      onOpenFile={onOpenFile}
      onOpenDiff={onOpenDiff}
      onSessionStarted={onSessionStarted}
      onPopout={onPopout}
      onPinToCanvas={onPinToCanvas}
      onClose={onClose}
    />
  )
}

// O alvo e os obstáculos são recalculados a cada lista de nós nova (todo quadro de um arraste); com
// os mesmos valores, o drawer não redesenha.
const sameRects = (a: readonly PanelRect[], b: readonly PanelRect[]) => a.length === b.length && a.every((r, i) => r === b[i])
const sameProps = (a: Props, b: Props) =>
  sameTarget(a.target, b.target) &&
  sameRects(a.obstacles, b.obstacles) &&
  (Object.keys(a) as (keyof Props)[]).every((k) => k === 'target' || k === 'obstacles' || Object.is(a[k], b[k]))

export const DrawerSlot = memo(DrawerSlotView, sameProps)
