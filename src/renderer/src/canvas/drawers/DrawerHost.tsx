import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { PANEL_MARGIN, PLAN_WIDTH, type PanelRect } from '../../conversation/FloatingPanel'
import { publishOpenPlan } from '../../conversation/openPlanStore'
import { MOTION, Presence } from '../../motion'
import { CodePanel } from './CodePanel'
import { DesignPanel } from './DesignPanel'
import type { DrawerLayout, SlotTargets } from './drawerLayout'
import { DrawerSlot, type SlotActions } from './DrawerSlot'
import { PlanPanel } from './PlanPanel'
import type { Drawer, DrawerState, SlotId } from './drawerState'
import type { DesignView, SlotTarget } from './drawerView'
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
  // Lista de conversas aberta: nenhum drawer entra nela ao mover ou redimensionar.
  aside: PanelRect | null
}

// Drawers por cima do canvas, nesta ordem (a de baixo aparece por cima): o painel de código (ou,
// no lugar dele, o plano aberto ao lado de um drawer), os
// drawers de conversa (do mais antigo ao mais novo) e o do design. O drawer de conversa só existe
// com a conversa na lista: se ela for excluída, sai daqui e a saída anima.
export function DrawerHost({ state, targets, design, layout, commands, actions, onShown, aside }: Props) {
  const { code } = layout
  const leaving = useLeaving(state.drawers)
  // Com vários drawers de conversa à vista, um não passa por cima nem por baixo dos outros.
  const placed = state.drawers.filter((d) => d.rect && targets[d.id])
  // O plano vai até a borda do drawer que o abriu (sem drawer, na largura padrão); o código volta
  // quando ele fecha.
  const planDrawer = state.plan?.slot ? placed.find((d) => d.id === state.plan?.slot) : undefined
  const drawerX = state.plan?.slot ? planDrawer?.rect?.x : PLAN_WIDTH + PANEL_MARGIN * 2
  const plan = state.plan && drawerX !== undefined ? { text: state.plan.text, path: state.plan.path, drawerX } : null
  // O cartão do plano aberto mostra "Fechar" no lugar de "Abrir ao lado".
  const planText = plan?.text ?? null
  useLayoutEffect(() => publishOpenPlan(planText, commands.closePlan), [planText, commands])
  return (
    <>
      <Presence>
        {plan && <PlanPanel key={plan.text} text={plan.text} path={plan.path} drawerX={plan.drawerX} onClose={commands.closePlan} />}
      </Presence>
      <Presence>
        {code && !plan && (
          <CodePanel
            root={code.root}
            name={code.name}
            file={state.code.file}
            rightOffset={layout.codeOffset}
            commands={commands}
          />
        )}
      </Presence>
      {leaving.map((id) => (
        <DrawerEntry key={id} slot={id} drawer={null} target={null} obstacles={NO_OBSTACLES} aside={null} codeOpen={false} {...{ commands, actions, onShown }} />
      ))}
      {state.drawers.map((d) => (
        <DrawerEntry
          key={d.id}
          slot={d.id}
          drawer={d}
          target={targets[d.id] ?? null}
          obstacles={placed}
          aside={aside}
          codeOpen={state.code.open && state.code.slot === d.id}
          {...{ commands, actions, onShown }}
        />
      ))}
      <Presence>{design && <DesignPanel key={design.designId} {...design} onClose={commands.closeDesign} />}</Presence>
    </>
  )
}

const NO_OBSTACLES: Drawer[] = []

type EntryProps = {
  slot: SlotId
  // Nulo: fechado, fazendo a saída.
  drawer: Drawer | null
  target: SlotTarget | null
  // Drawers à vista com lugar definido (este incluso: sai da conta aqui).
  obstacles: Drawer[]
  aside: PanelRect | null
  codeOpen: boolean
  commands: DrawerCommands
  actions: SlotActions
  onShown: (slot: SlotId, title: string | null) => void
}

// Um drawer de conversa com a sua entrada e saída. A conversa é procurada aqui, fora do Presence,
// para a saída animar quando ela some da lista.
function DrawerEntry({ slot, drawer, target, obstacles, aside, codeOpen, commands, actions, onShown }: EntryProps) {
  const active = drawer?.conversation ?? null
  const conversation = useSlotConversation(active, target)
  const others = useMemo(() => {
    const rects = obstacles.flatMap((o) => (o.id !== slot && o.rect ? [o.rect] : []))
    return aside ? [...rects, aside] : rects
  }, [obstacles, slot, aside])
  return (
    <Presence>
      {drawer && active && target && conversation && (
        <DrawerSlot
          slot={slot}
          active={active}
          conversation={conversation}
          target={target}
          rect={drawer.rect}
          obstacles={others}
          pinned={drawer.pinned}
          codeOpen={codeOpen}
          commands={commands}
          actions={actions}
          onShown={onShown}
        />
      )}
    </Presence>
  )
}

// Drawers que acabaram de fechar: ficam montados (vazios) o tempo da saída, para o Presence de cada
// um mostrar o último conteúdo sumindo.
function useLeaving(drawers: readonly Drawer[]): SlotId[] {
  const [prev, setPrev] = useState(drawers)
  const [gone, setGone] = useState<SlotId[]>([])
  if (prev !== drawers) {
    const removed = prev.filter((p) => !drawers.some((d) => d.id === p.id)).map((p) => p.id)
    setPrev(drawers)
    if (removed.length) setGone((g) => [...g, ...removed])
  }
  useEffect(() => {
    if (!gone.length) return
    const timer = setTimeout(() => setGone([]), MOTION.panel.out.duration + 100)
    return () => clearTimeout(timer)
  }, [gone])
  return gone
}

