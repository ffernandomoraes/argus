import { PANEL_DEFAULT_WIDTH, PANEL_MARGIN } from '../../conversation/FloatingPanel'
import { looseDrawer, type DrawerState, type SlotId } from './drawerState'
import type { SlotTarget } from './drawerView'
import type { ShownTitles } from './useShownDrawers'

// De onde abriu a conversa de cada drawer (nulo: a pasta ou o card saiu do canvas).
export type SlotTargets = Readonly<Record<SlotId, SlotTarget | null>>

// Drawer de conversa à vista: de onde a conversa abriu e o título dela.
type ShownDrawer = { target: SlotTarget; title: string }

export type DrawerLayout = {
  // O drawer à vista que vale para o título da janela e para a memória: o solto, senão o último
  // aberto.
  shown: ShownDrawer | null
  // Pasta do painel de código, quando ele está aberto com uma.
  code: { root: string; name: string } | null
  // Espaço ocupado pelos drawers à direita do painel de código.
  codeOffset: number | string
}

// O que o resto da tela precisa saber dos drawers à vista. O drawer fechado sai daqui na hora (o
// alvo some com o estado), mesmo enquanto ainda faz o fade de saída.
export function drawerLayout(state: DrawerState, targets: SlotTargets, titles: ShownTitles): DrawerLayout {
  const visible = state.drawers.flatMap((d) => {
    const target = targets[d.id]
    const title = titles[d.id]
    return target && title !== undefined ? [{ drawer: d, shown: { target, title } }] : []
  })
  const loose = looseDrawer(state.drawers)
  const shown = (visible.find((v) => v.drawer === loose) ?? visible[visible.length - 1])?.shown ?? null
  // O código vai até o drawer mais à esquerda (com vários à vista, um pode estar ao lado do outro).
  const xs = visible.flatMap((v) => (v.drawer.rect ? [v.drawer.rect.x] : []))
  const edge = xs.length ? Math.min(...xs) : null
  // Sem o painel da conversa aberto, o código vai até a borda direita.
  const codeOffset = !shown
    ? PANEL_MARGIN
    : edge !== null
      ? `calc(100% - ${edge - PANEL_MARGIN}px)`
      : PANEL_DEFAULT_WIDTH + PANEL_MARGIN * 2
  // Pasta do código: a do link clicado numa conversa do canvas ou, sem isso, a do drawer dele.
  const project = state.code.project ?? visible.find((v) => v.drawer.id === state.code.slot)?.shown.target.project
  const code = state.code.open && project ? { root: project.path, name: project.name } : null
  return { shown, code, codeOffset }
}
