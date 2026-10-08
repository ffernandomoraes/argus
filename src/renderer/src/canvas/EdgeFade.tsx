import type { CSSProperties } from 'react'
import { TITLE_BAR_HEIGHT } from '../conversation/FloatingPanel'

// Largura da faixa esfumaçada em cada borda. O "ver tudo" deixa folga maior que ela, para os
// nomes dos grupos não caírem no borrão (useCanvasShortcuts).
export const FADE_SIZE = 48

type Side = 'top' | 'bottom' | 'left' | 'right'

// Para onde o efeito some: da borda para o centro do canvas.
const TOWARD: Record<Side, string> = { top: 'to bottom', bottom: 'to top', left: 'to right', right: 'to left' }

const PLACE: Record<Side, CSSProperties> = {
  top: { top: TITLE_BAR_HEIGHT, left: 0, right: 0, height: FADE_SIZE },
  bottom: { bottom: 0, left: 0, right: 0, height: FADE_SIZE },
  left: { top: TITLE_BAR_HEIGHT, bottom: 0, left: 0, width: FADE_SIZE },
  right: { top: TITLE_BAR_HEIGHT, bottom: 0, right: 0, width: FADE_SIZE }
}

// Bordas do canvas esfumaçadas: desfoque e a cor do fundo, fortes na beirada e sumindo para o
// centro. Os blocos que passam por baixo da navegação, do zoom e dos limites (todos nos cantos)
// deixam de brigar com eles. Fica acima dos blocos (camada 4 do React Flow) e abaixo dos painéis
// (camada 5); não pega o mouse. São quatro faixas em vez de uma camada na tela toda, para o
// desfoque ser calculado só nas bordas ao arrastar o canvas.
export function EdgeFade() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[4] overflow-hidden">
      {(Object.keys(PLACE) as Side[]).map((side) => {
        const mask = `linear-gradient(${TOWARD[side]}, black, transparent)`
        return (
          <div
            key={side}
            className="absolute"
            style={{
              ...PLACE[side],
              background: `linear-gradient(${TOWARD[side]}, color-mix(in srgb, var(--color-bg) 65%, transparent), transparent)`,
              backdropFilter: 'blur(3px)',
              maskImage: mask,
              WebkitMaskImage: mask
            }}
          />
        )
      })}
    </div>
  )
}
