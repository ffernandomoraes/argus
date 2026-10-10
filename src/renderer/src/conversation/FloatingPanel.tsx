import type { PointerEvent } from 'react'
import type { Edges } from './panelGeometry'

// Painel flutuante: a geometria fica em panelGeometry.ts e o arraste em hooks/useFloatingRect.ts.
// Daqui saem também os dois, como antes, para o canvas, o código e o design.
export {
  DRAWER_DEFAULT_WIDTH,
  PANEL_DEFAULT_WIDTH,
  PANEL_MARGIN,
  PANEL_TOP,
  TITLE_BAR_HEIGHT,
  freeSpot,
  type AreaSize,
  type PanelRect
} from './panelGeometry'
export { useFloatingRect } from './hooks/useFloatingRect'

const HANDLES: { edges: Edges; className: string; label: string }[] = [
  { edges: { left: true }, className: 'inset-y-2 left-0 w-1.5 cursor-ew-resize', label: 'Redimensionar pela esquerda' },
  { edges: { right: true }, className: 'inset-y-2 right-0 w-1.5 cursor-ew-resize', label: 'Redimensionar pela direita' },
  { edges: { top: true }, className: 'inset-x-2 top-0 h-1.5 cursor-ns-resize', label: 'Redimensionar por cima' },
  { edges: { bottom: true }, className: 'inset-x-2 bottom-0 h-1.5 cursor-ns-resize', label: 'Redimensionar por baixo' },
  { edges: { top: true, left: true }, className: 'left-0 top-0 size-3 cursor-nwse-resize', label: 'Canto superior esquerdo' },
  { edges: { top: true, right: true }, className: 'right-0 top-0 size-3 cursor-nesw-resize', label: 'Canto superior direito' },
  { edges: { bottom: true, left: true }, className: 'bottom-0 left-0 size-3 cursor-nesw-resize', label: 'Canto inferior esquerdo' },
  { edges: { bottom: true, right: true }, className: 'bottom-0 right-0 size-3 cursor-nwse-resize', label: 'Canto inferior direito' }
]

// As quatro bordas e os cantos que redimensionam o painel.
export function ResizeHandles({ onResizeStart }: { onResizeStart: (edges: Edges) => (e: PointerEvent) => void }) {
  return (
    <>
      {HANDLES.map((h) => (
        <div
          key={h.label}
          role="separator"
          aria-label={h.label}
          onPointerDown={onResizeStart(h.edges)}
          className={`absolute z-20 hover:bg-line-strong/60 ${h.className}`}
        />
      ))}
    </>
  )
}
