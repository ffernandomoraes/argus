import { PANEL_DEFAULT_WIDTH, PANEL_MARGIN } from '../../conversation/FloatingPanel'
import type { DrawerState } from './drawerState'
import type { SlotTarget } from './drawerView'
import type { ShownTitles } from './useShownDrawers'

export type SlotTargets = { main: SlotTarget | null; second: SlotTarget | null }

// Drawer de conversa à vista: de onde a conversa abriu e o título dela.
type ShownDrawer = { target: SlotTarget; title: string }

export type DrawerLayout = {
  // O drawer à vista que vale para o título da janela e para a memória: o de cima, senão o segundo.
  shown: ShownDrawer | null
  // Pasta do painel de código, quando ele está aberto com uma.
  code: { root: string; name: string } | null
  // Espaço ocupado pelos drawers à direita do painel de código.
  codeOffset: number | string
}

// O que o resto da tela precisa saber dos drawers à vista. O drawer fechado sai daqui na hora (o
// alvo some com o estado), mesmo enquanto ainda faz o fade de saída.
export function drawerLayout(state: DrawerState, targets: SlotTargets, titles: ShownTitles): DrawerLayout {
  const main = targets.main && titles.main !== null ? { target: targets.main, title: titles.main } : null
  const second = targets.second && titles.second !== null ? { target: targets.second, title: titles.second } : null
  const shown = main ?? second
  // O código vai até o drawer mais à esquerda (com dois à vista, um pode estar ao lado do outro).
  const xs = [main && state.mainRect?.x, second && state.secondRect?.x].filter((x): x is number => typeof x === 'number')
  const edge = xs.length ? Math.min(...xs) : null
  // Sem o painel da conversa aberto, o código vai até a borda direita.
  const codeOffset = !shown
    ? PANEL_MARGIN
    : edge !== null
      ? `calc(100% - ${edge - PANEL_MARGIN}px)`
      : PANEL_DEFAULT_WIDTH + PANEL_MARGIN * 2
  // Pasta do código: a do link clicado numa conversa do canvas ou, sem isso, a do drawer dele.
  const project = state.code.project ?? (state.code.slot === 'second' ? second : main)?.target.project
  const code = state.code.open && project ? { root: project.path, name: project.name } : null
  return { shown, code, codeOffset }
}
