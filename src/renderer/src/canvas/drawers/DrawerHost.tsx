import { Presence } from '../../motion'
import { CodePanel } from './CodePanel'
import { DesignPanel } from './DesignPanel'
import type { DrawerLayout, SlotTargets } from './drawerLayout'
import { DrawerSlot, type SlotActions } from './DrawerSlot'
import type { DrawerState, SlotId } from './drawerState'
import type { DesignView } from './drawerView'
import type { DrawerCommands } from './useDrawers'
import { useSlotConversation } from './useSlotConversation'

type Props = {
  state: DrawerState
  targets: SlotTargets
  design: DesignView | null
  layout: DrawerLayout
  commands: DrawerCommands
  actions: SlotActions
  onShown: (slot: SlotId, title: string | null) => void
}

// Drawers por cima do canvas, nesta ordem (a de baixo aparece por cima): o painel de código, o
// drawer de conversa principal, o segundo e o do design. O drawer de conversa só existe com a
// conversa na lista: se ela for excluída, sai daqui e a saída anima.
export function DrawerHost({ state, targets, design, layout, commands, actions, onShown }: Props) {
  const { code } = layout
  const mainConversation = useSlotConversation(state.main, targets.main)
  const secondConversation = useSlotConversation(state.second, targets.second)
  return (
    <>
      <Presence>
        {code && (
          <CodePanel
            root={code.root}
            name={code.name}
            file={state.code.file}
            rightOffset={layout.codeOffset}
            commands={commands}
          />
        )}
      </Presence>
      <Presence>
        {state.main && targets.main && mainConversation && (
          <DrawerSlot
            slot="main"
            active={state.main}
            conversation={mainConversation}
            target={targets.main}
            rect={state.mainRect}
            pinned={state.pinned}
            codeOpen={state.code.open && state.code.slot === 'main'}
            commands={commands}
            actions={actions}
            onShown={onShown}
          />
        )}
      </Presence>
      <Presence>
        {state.second && targets.second && secondConversation && (
          <DrawerSlot
            slot="second"
            active={state.second}
            conversation={secondConversation}
            target={targets.second}
            rect={state.secondRect}
            pinned={state.pinned}
            codeOpen={state.code.open && state.code.slot === 'second'}
            commands={commands}
            actions={actions}
            onShown={onShown}
          />
        )}
      </Presence>
      <Presence>{design && <DesignPanel key={design.designId} {...design} onClose={commands.closeDesign} />}</Presence>
    </>
  )
}
