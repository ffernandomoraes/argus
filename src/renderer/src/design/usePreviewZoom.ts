import { useEffect, useEffectEvent, useState } from 'react'
import { isMod } from '../platform'

const STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 3]

// Degrau seguinte (ou anterior) ao que está na tela, que pode estar entre dois degraus (o ajustar).
function stepFrom(scale: number, direction: 1 | -1): number {
  if (direction === 1) return STEPS.find((s) => s > scale + 0.001) ?? STEPS[STEPS.length - 1]
  return [...STEPS].reverse().find((s) => s < scale - 0.001) ?? STEPS[0]
}

// ⌘+ / ⌘- / ⌘0 (Ctrl fora do Mac): +1, -1, 0 (ajustar); outra tecla, null.
export function zoomStepOf(e: KeyboardEvent): 1 | -1 | 0 | null {
  if (!isMod(e) || e.altKey) return null
  if (e.key === '=' || e.key === '+') return 1
  if (e.key === '-' || e.key === '_') return -1
  if (e.key === '0') return 0
  return null
}

// Zoom da página do protótipo. Sem escolha (null), ela cabe na largura do quadro ("ajustar");
// com zoom, fica do tamanho escolhido e, maior que o quadro, rola para os lados. Vale enquanto o
// design está aberto. `enabled`: os atalhos só com a página na tela.
export function usePreviewZoom(enabled: boolean) {
  const [zoom, setZoom] = useState<number | null>(null)
  // A escala do ajustar, medida pelo quadro (PrototypeFrame).
  const [fit, setFit] = useState(1)
  const scale = zoom ?? fit

  const step = (s: 1 | -1 | 0) => setZoom(s === 0 ? null : stepFrom(scale, s))
  const stepEvent = useEffectEvent(step)

  // Com o design aberto, ⌘+ / ⌘- são do zoom da página: na captura, antes do zoom do canvas e do
  // texto dos drawers. Com o foco dentro da página, ela mesma avisa (ver designPicker TRACK).
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      const s = zoomStepOf(e)
      if (s === null) return
      e.preventDefault()
      e.stopPropagation()
      stepEvent(s)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [enabled])

  return { zoom, scale, fitting: zoom === null, setFit, step }
}

export type PreviewZoom = ReturnType<typeof usePreviewZoom>
