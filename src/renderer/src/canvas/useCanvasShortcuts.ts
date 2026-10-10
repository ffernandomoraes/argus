import { useCallback, useEffect } from 'react'
import { getViewportForBounds, useReactFlow, useStoreApi, type Rect } from '@xyflow/react'
import { TITLE_BAR_HEIGHT } from '../conversation/FloatingPanel'
import { isMod } from '../platform'
import { FADE_SIZE } from './EdgeFade'
import { isEditableTarget } from './keys/keyTargets'

export const ZOOM_DURATION = 200
const FIT_DURATION = 300
// Nome do grupo e do projeto ficam acima da borda (bottom-full + mb-1.5 + h-6), fora da caixa
// do nó; o enquadramento precisa contar com eles.
const LABEL_SPACE = 32
// Respiro entre os blocos enquadrados e o que cobre a borda.
const FIT_GAP = 16

type Side = 'top' | 'right' | 'bottom' | 'left'
type Insets = Record<Side, number>

// O que cobre cada borda do canvas, em px de tela: a barra de título em cima, o esfumaçado das
// bordas (EdgeFade) e as barras flutuantes (os Panel do React Flow: navegação, limites do
// Claude, zoom e minimapa). As barras são medidas na hora: o minimapa aberto, por exemplo, deixa
// a barra do zoom bem mais alta. Cada uma conta só na borda em que encosta; a de canto, na borda
// em que ocupa menos (a do zoom com o minimapa aberto empurra a direita, não o rodapé inteiro).
function coveredInsets(container: HTMLElement | null): Insets {
  const out: Insets = { top: TITLE_BAR_HEIGHT + FADE_SIZE, right: FADE_SIZE, bottom: FADE_SIZE, left: FADE_SIZE }
  // Com a interface oculta (⌘\), as barras ficam transparentes e não cobrem nada.
  if (container && !container.classList.contains('ui-hidden')) {
    const box = container.getBoundingClientRect()
    for (const panel of container.querySelectorAll('.react-flow__panel')) {
      const r = panel.getBoundingClientRect()
      if (!r.width || !r.height) continue
      const reach: Insets = {
        top: r.bottom - box.top,
        right: box.right - r.left,
        bottom: box.bottom - r.top,
        left: r.right - box.left
      }
      const side = (Object.keys(reach) as Side[]).reduce((a, b) => (reach[b] < reach[a] ? b : a))
      out[side] = Math.max(out[side], reach[side])
    }
  }
  return { top: out.top + FIT_GAP, right: out.right + FIT_GAP, bottom: out.bottom + FIT_GAP, left: out.left + FIT_GAP }
}

// Enquadrar um trecho do canvas na área que sobra livre entre as barras.
// - frame: com `onlyIfCovered`, só mexe se algo do trecho estiver fora da área livre ou embaixo
//   de uma barra, e sem aproximar: no máximo afasta o suficiente para caber.
// - freeAspect: proporção da área livre, para organizar os blocos no formato que cabe na tela.
export function useFrame() {
  const { getViewport, setViewport } = useReactFlow()
  const store = useStoreApi()

  const frame = useCallback(
    (bounds: Rect, { onlyIfCovered = false } = {}) => {
      const { width, height, minZoom, maxZoom, domNode } = store.getState()
      const pad = coveredInsets(domNode)
      let zoomLimit = maxZoom
      if (onlyIfCovered) {
        const { x, y, zoom } = getViewport()
        const left = bounds.x * zoom + x
        const top = bounds.y * zoom + y
        const right = left + bounds.width * zoom
        const bottom = top + bounds.height * zoom
        if (left >= pad.left && top >= pad.top && right <= width - pad.right && bottom <= height - pad.bottom) return
        zoomLimit = zoom
      }
      const padding = { top: `${pad.top}px`, right: `${pad.right}px`, bottom: `${pad.bottom}px`, left: `${pad.left}px` } as const
      void setViewport(getViewportForBounds(bounds, width, height, minZoom, zoomLimit, padding), { duration: FIT_DURATION })
    },
    [getViewport, setViewport, store]
  )

  const freeAspect = useCallback(() => {
    const { width, height, domNode } = store.getState()
    const pad = coveredInsets(domNode)
    const free = { width: width - pad.left - pad.right, height: height - pad.top - pad.bottom }
    return free.width > 0 && free.height > 0 ? free.width / free.height : window.innerWidth / window.innerHeight
  }, [store])

  return { frame, freeAspect }
}

// "Ver tudo": enquadra todos os blocos visíveis, com os nomes acima deles inteiros.
export function useFitAll() {
  const { getNodes, getNodesBounds } = useReactFlow()
  const { frame } = useFrame()

  return useCallback(() => {
    const nodes = getNodes().filter((n) => !n.hidden)
    if (!nodes.length) return
    const box = getNodesBounds(nodes)
    frame({ ...box, y: box.y - LABEL_SPACE, height: box.height + LABEL_SPACE })
  }, [getNodes, getNodesBounds, frame])
}

// Atalhos no padrão do Figma: ⌘= / ⌘- zoom, ⇧1 ver tudo, ⇧0 100%.
// Com o drawer aberto, ⌘= / ⌘- passam a ser dele (useDrawerZoom) e `zoom` vem falso.
// ⌘ no Mac e Ctrl no Windows (isMod): no Mac, o Ctrl não é atalho do app.
export function useCanvasShortcuts(zoom = true) {
  const { zoomIn, zoomOut, zoomTo } = useReactFlow()
  const fitAll = useFitAll()

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return

      const mod = isMod(e)
      if (mod && !zoom) return
      if (mod && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        void zoomIn({ duration: ZOOM_DURATION })
      } else if (mod && e.key === '-') {
        e.preventDefault()
        void zoomOut({ duration: ZOOM_DURATION })
      } else if (e.shiftKey && e.code === 'Digit1') {
        fitAll()
      } else if (e.shiftKey && e.code === 'Digit0') {
        void zoomTo(1, { duration: ZOOM_DURATION })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [zoomIn, zoomOut, zoomTo, fitAll, zoom])
}
