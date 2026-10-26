import type { PointerEvent } from 'react'
import type { Edges } from './panelGeometry'
import { tr } from '../i18n'

// Painel flutuante: a geometria fica em panelGeometry.ts e o arraste em hooks/useFloatingRect.ts.
// Daqui saem também os dois, como antes, para o canvas, o código e o design.
export {
  BOTTOM_BAR_HEIGHT,
  CANVAS_BAR_INSET,
  DRAWER_DEFAULT_WIDTH,
  PANEL_DEFAULT_WIDTH,
  PANEL_BOTTOM,
  PANEL_MARGIN,
  PANEL_TOP,
  PLAN_WIDTH,
  TITLE_BAR_HEIGHT,
  cascadeSpot,
  fitBeside,
  freeSpot,
  roomForPlan,
  type AreaSize,
  type PanelSide,
  type PanelRect
} from './panelGeometry'
export { useFloatingRect } from './hooks/useFloatingRect'

const HANDLES: { edges: Edges; className: string; label: string }[] = [
  { edges: { left: true }, className: 'inset-y-2 left-0 w-1.5 cursor-ew-resize', label: tr('Redimensionar pela esquerda', 'Resize from left') },
  { edges: { right: true }, className: 'inset-y-2 right-0 w-1.5 cursor-ew-resize', label: tr('Redimensionar pela direita', 'Resize from right') },
  { edges: { top: true }, className: 'inset-x-2 top-0 h-1.5 cursor-ns-resize', label: tr('Redimensionar por cima', 'Resize from top') },
  { edges: { bottom: true }, className: 'inset-x-2 bottom-0 h-1.5 cursor-ns-resize', label: tr('Redimensionar por baixo', 'Resize from bottom') },
  { edges: { top: true, left: true }, className: 'left-0 top-0 size-3 cursor-nwse-resize', label: tr('Canto superior esquerdo', 'Top-left corner') },
  { edges: { top: true, right: true }, className: 'right-0 top-0 size-3 cursor-nesw-resize', label: tr('Canto superior direito', 'Top-right corner') },
  { edges: { bottom: true, left: true }, className: 'bottom-0 left-0 size-3 cursor-nesw-resize', label: tr('Canto inferior esquerdo', 'Bottom-left corner') },
  { edges: { bottom: true, right: true }, className: 'bottom-0 right-0 size-3 cursor-nwse-resize', label: tr('Canto inferior direito', 'Bottom-right corner') }
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
