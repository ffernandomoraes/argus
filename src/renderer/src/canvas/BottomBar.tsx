import { memo, useState } from 'react'
import { BOTTOM_BAR_HEIGHT } from '../conversation/FloatingPanel'
import { usePreference } from '../settings/preferences'
import { MediaControls } from './bars/MediaControls'
import { RunningIndicator } from './RunningIndicator'
import { UsageIndicator } from './UsageIndicator'

// Barra de baixo, par da barra de título: à esquerda, as conversas trabalhando ou esperando você;
// no meio, o player; à direita, os limites de uso. Os painéis param acima dela (PANEL_BOTTOM) e
// tudo o que ela abre vai para cima. Fica à vista mesmo com a interface oculta (⌘\), como a de cima.
export const BottomBar = memo(function BottomBar({ onOpenChat }: { onOpenChat: (cwd: string, sessionId: string) => void }) {
  const [usageOpen, setUsageOpen] = useState(false)
  const mediaPlayer = usePreference('mediaPlayer')

  return (
    // Mesmas camadas da barra de título: com algo aberto (ou o mouse em cima) sobe acima dos drawers,
    // para a lista e os limites não ficarem por baixo deles.
    <div
      style={{ height: BOTTOM_BAR_HEIGHT }}
      className="absolute inset-x-0 bottom-0 z-[35] flex items-center justify-between gap-2 border-t border-line bg-surface px-3 hover:z-[55] has-[[aria-expanded=true]]:z-[55]"
    >
      <RunningIndicator onOpen={onOpenChat} />
      {/* No meio da barra, não entre os dois lados. Desligado, nem consulta o sistema. */}
      {mediaPlayer && (
        <div className="absolute inset-y-0 left-1/2 flex -translate-x-1/2 items-center">
          <MediaControls />
        </div>
      )}
      <span className="ml-auto flex items-center self-stretch">
        <UsageIndicator open={usageOpen} onOpenChange={setUsageOpen} />
      </span>
    </div>
  )
})
