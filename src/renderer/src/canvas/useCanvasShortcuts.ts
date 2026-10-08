import { useCallback, useEffect } from 'react'
import { getViewportForBounds, useReactFlow, useStoreApi } from '@xyflow/react'
import { TITLE_BAR_HEIGHT } from '../conversation/FloatingPanel'
import { FADE_SIZE } from './EdgeFade'

export const ZOOM_DURATION = 200
const FIT_DURATION = 300
// Nome do grupo e do projeto ficam acima da borda (bottom-full + mb-1.5 + h-6), fora da caixa
// do nó; o enquadramento precisa contar com eles.
const LABEL_SPACE = 32
// Em px de tela: a barra de título cobre o topo do canvas, as barras de zoom, uso e navegação
// ficam por cima das bordas, e as bordas são esfumaçadas (EdgeFade): nada pode cair no borrão.
const FIT_PADDING = {
  top: `${TITLE_BAR_HEIGHT + FADE_SIZE + 12}px`,
  bottom: '64px',
  left: '72px',
  right: '72px'
} as const

// "Ver tudo": enquadra todos os blocos visíveis, com os nomes acima deles inteiros.
export function useFitAll() {
  const { getNodes, getNodesBounds, setViewport } = useReactFlow()
  const store = useStoreApi()

  return useCallback(() => {
    const nodes = getNodes().filter((n) => !n.hidden)
    if (!nodes.length) return
    const box = getNodesBounds(nodes)
    const bounds = { ...box, y: box.y - LABEL_SPACE, height: box.height + LABEL_SPACE }
    const { width, height, minZoom, maxZoom } = store.getState()
    const viewport = getViewportForBounds(bounds, width, height, minZoom, maxZoom, FIT_PADDING)
    setViewport(viewport, { duration: FIT_DURATION })
  }, [getNodes, getNodesBounds, setViewport, store])
}

// Atalhos no padrão do Figma: ⌘= / ⌘- zoom, ⇧1 ver tudo, ⇧0 100%.
// Com o drawer aberto, ⌘= / ⌘- passam a ser dele (useDrawerZoom) e `zoom` vem falso.
export function useCanvasShortcuts(zoom = true) {
  const { zoomIn, zoomOut, zoomTo } = useReactFlow()
  const fitAll = useFitAll()

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, [contenteditable="true"]')) return

      const mod = e.metaKey || e.ctrlKey
      if (mod && !zoom) return
      if (mod && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        zoomIn({ duration: ZOOM_DURATION })
      } else if (mod && e.key === '-') {
        e.preventDefault()
        zoomOut({ duration: ZOOM_DURATION })
      } else if (e.shiftKey && e.code === 'Digit1') {
        fitAll()
      } else if (e.shiftKey && e.code === 'Digit0') {
        zoomTo(1, { duration: ZOOM_DURATION })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [zoomIn, zoomOut, zoomTo, fitAll, zoom])
}
