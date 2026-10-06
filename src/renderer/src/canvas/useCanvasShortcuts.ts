import { useEffect } from 'react'
import { useReactFlow } from '@xyflow/react'

export const ZOOM_DURATION = 200
export const FIT_OPTIONS = { padding: 0.15, duration: 300 }

// Atalhos no padrão do Figma: ⌘= / ⌘- zoom, ⇧1 ver tudo, ⇧0 100%.
// Com o drawer aberto, ⌘= / ⌘- passam a ser dele (useDrawerZoom) e `zoom` vem falso.
export function useCanvasShortcuts(zoom = true) {
  const { zoomIn, zoomOut, zoomTo, fitView } = useReactFlow()

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
        fitView(FIT_OPTIONS)
      } else if (e.shiftKey && e.code === 'Digit0') {
        zoomTo(1, { duration: ZOOM_DURATION })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [zoomIn, zoomOut, zoomTo, fitView, zoom])
}
