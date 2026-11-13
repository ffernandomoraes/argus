import { useCallback, useState } from 'react'
import type { SlotId } from './drawerState'

// Título da conversa de cada drawer à vista; fora daqui: nada na tela.
export type ShownTitles = Readonly<Record<SlotId, string>>

const NONE: ShownTitles = {}

// Quem sabe se a conversa ainda existe e qual o título dela é o próprio drawer, que acompanha só a
// lista da pasta dele (DrawerSlot). Ele avisa aqui, e o Canvas usa no título da janela, no
// escurecido do fundo e no painel de código, sem assinar as conversas de todas as pastas.
export function useShownDrawers(): { titles: ShownTitles; report: (slot: SlotId, title: string | null) => void } {
  const [titles, setTitles] = useState(NONE)
  const report = useCallback(
    (slot: SlotId, title: string | null) =>
      setTitles((t) => {
        if ((t[slot] ?? null) === title) return t
        if (title !== null) return { ...t, [slot]: title }
        const { [slot]: _gone, ...rest } = t // eslint-disable-line @typescript-eslint/no-unused-vars
        return rest
      }),
    []
  )
  return { titles, report }
}
