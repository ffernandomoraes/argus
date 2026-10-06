import { useLayoutEffect, useRef, type PointerEvent, type RefObject } from 'react'

// Painel flutuante com posição e tamanho livres dentro da área do canvas:
// arrasta pelo cabeçalho e redimensiona pelas quatro bordas e pelos cantos.

export type PanelRect = { x: number; y: number; width: number; height: number }

const MARGIN = 16
export const PANEL_MIN = { width: 360, height: 320 }
export const PANEL_DEFAULT_WIDTH = 550

type Edges = { left?: boolean; right?: boolean; top?: boolean; bottom?: boolean }

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

function areaSize(el: HTMLElement | null) {
  const area = el?.parentElement
  return area ? { width: area.clientWidth, height: area.clientHeight } : null
}

// Sem posição definida ainda, o painel nasce encostado à direita, na altura toda.
export function useFloatingRect(
  ref: RefObject<HTMLElement | null>,
  rect: PanelRect | null,
  onChange: (rect: PanelRect) => void
) {
  useLayoutEffect(() => {
    if (rect) return
    const area = areaSize(ref.current)
    if (!area) return
    const width = Math.min(PANEL_DEFAULT_WIDTH, area.width - MARGIN * 2)
    onChange({ x: area.width - MARGIN - width, y: MARGIN, width, height: area.height - MARGIN * 2 })
  }, [rect]) // eslint-disable-line react-hooks/exhaustive-deps

  // Mesmo gesto serve para mover (todas as bordas juntas) e redimensionar (só algumas).
  const begin = (e: PointerEvent, edges: Edges | 'move') => {
    const area = areaSize(ref.current)
    if (e.button !== 0 || !rect || !area) return
    if (edges === 'move' && (e.target as HTMLElement).closest('button, input, select, textarea')) return
    e.preventDefault()
    e.stopPropagation()
    const pointer = { x: e.clientX, y: e.clientY }
    const max = { right: area.width - MARGIN, bottom: area.height - MARGIN }

    const onMove = (ev: globalThis.PointerEvent) => {
      const dx = ev.clientX - pointer.x
      const dy = ev.clientY - pointer.y
      if (edges === 'move') {
        onChange({
          ...rect,
          x: clamp(rect.x + dx, MARGIN, max.right - rect.width),
          y: clamp(rect.y + dy, MARGIN, max.bottom - rect.height)
        })
        return
      }
      let { x, y, width, height } = rect
      if (edges.left) {
        x = clamp(rect.x + dx, MARGIN, rect.x + rect.width - PANEL_MIN.width)
        width = rect.x + rect.width - x
      }
      if (edges.right) width = clamp(rect.width + dx, PANEL_MIN.width, max.right - rect.x)
      if (edges.top) {
        y = clamp(rect.y + dy, MARGIN, rect.y + rect.height - PANEL_MIN.height)
        height = rect.y + rect.height - y
      }
      if (edges.bottom) height = clamp(rect.height + dy, PANEL_MIN.height, max.bottom - rect.y)
      onChange({ x, y, width, height })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.cursor = ''
    }
    document.body.style.cursor = getComputedStyle(e.currentTarget as Element).cursor
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return {
    onMoveStart: (e: PointerEvent) => begin(e, 'move'),
    onResizeStart: (edges: Edges) => (e: PointerEvent) => begin(e, edges)
  }
}

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
