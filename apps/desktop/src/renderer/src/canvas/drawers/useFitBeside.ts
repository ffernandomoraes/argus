import { useLayoutEffect } from 'react'
import { fitBeside, type PanelRect } from '../../conversation/FloatingPanel'
import type { Drawer } from './drawerState'
import type { DrawerCommands } from './useDrawers'

// Com a lista de conversas aberta, nenhum drawer fica por baixo dela: o que cobre (o que já estava
// aberto, o que acabou de nascer, ou depois de a lista crescer ou a janela mudar) vai para o lado e
// encolhe para caber. Arrastando, quem impede é o obstáculo (DrawerHost).
export function useFitBeside(aside: PanelRect | null, drawers: readonly Drawer[], commands: DrawerCommands) {
  useLayoutEffect(() => {
    if (!aside) return
    for (const d of drawers) {
      if (!d.rect) continue
      const next = fitBeside(d.rect, aside)
      if (next !== d.rect) commands.setRect(d.id, next)
    }
  }, [aside, drawers, commands])
}
