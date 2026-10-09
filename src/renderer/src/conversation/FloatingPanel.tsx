import { useLayoutEffect, useRef, type PointerEvent, type RefObject } from 'react'

// Painel flutuante com posição e tamanho livres dentro da área do canvas:
// arrasta pelo cabeçalho e redimensiona pelas quatro bordas e pelos cantos.

// `area` é o tamanho da área do canvas quando o rect foi definido: se a janela muda de tamanho
// (ex.: foi para outro monitor), o painel é reescalado na mesma proporção em vez de quebrar.
export type PanelRect = { x: number; y: number; width: number; height: number; area?: AreaSize }
export type AreaSize = { width: number; height: number }

// Folga mínima entre o painel e as bordas da área (laterais, embaixo e abaixo da barra de título).
export const PANEL_MARGIN = 8
const MARGIN = PANEL_MARGIN
// Barra de título transparente no topo da janela (TitleBar): os painéis começam abaixo dela.
export const TITLE_BAR_HEIGHT = 40
export const PANEL_TOP = TITLE_BAR_HEIGHT + MARGIN
export const PANEL_MIN = { width: 360, height: 320 }
export const PANEL_DEFAULT_WIDTH = 550
// O painel da conversa nasce um pouco mais largo que os outros: é onde se lê e escreve.
export const DRAWER_DEFAULT_WIDTH = PANEL_DEFAULT_WIDTH + 50

type Edges = { left?: boolean; right?: boolean; top?: boolean; bottom?: boolean }

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

function areaSize(el: HTMLElement | null): AreaSize | null {
  const area = el?.parentElement
  return area ? { width: area.clientWidth, height: area.clientHeight } : null
}

// Reposiciona o rect da área antiga para a nova mantendo a proporção do espaço útil
// (descontadas as margens e a barra de título), e garante que caiba inteiro na nova.
function rescale(rect: PanelRect, from: AreaSize, to: AreaSize): PanelRect {
  const usable = (a: AreaSize) => ({ width: a.width - MARGIN * 2, height: a.height - PANEL_TOP - MARGIN })
  const a = usable(from)
  const b = usable(to)
  const sx = a.width > 0 ? b.width / a.width : 1
  const sy = a.height > 0 ? b.height / a.height : 1
  const width = clamp(rect.width * sx, Math.min(PANEL_MIN.width, b.width), b.width)
  const height = clamp(rect.height * sy, Math.min(PANEL_MIN.height, b.height), b.height)
  const x = clamp(MARGIN + (rect.x - MARGIN) * sx, MARGIN, to.width - MARGIN - width)
  const y = clamp(PANEL_TOP + (rect.y - PANEL_TOP) * sy, PANEL_TOP, to.height - MARGIN - height)
  return { x, y, width, height, area: to }
}

// Lugar de um segundo painel que não cubra o fixado. Primeiro na mesma coluna, acima ou abaixo dele
// (onde sobrar mais altura); sem altura para isso, ao lado, na largura padrão (ou no que couber),
// encostado nele e na altura toda. Sem espaço em lugar nenhum, nulo: nasce no lugar padrão.
export function freeSpot(pinned: PanelRect, area: AreaSize, width: number): PanelRect | null {
  const bottom = area.height - MARGIN
  const above = pinned.y - MARGIN - PANEL_TOP
  const below = bottom - (pinned.y + pinned.height + MARGIN)
  if (Math.max(above, below) >= PANEL_MIN.height) {
    const y = above > below ? PANEL_TOP : pinned.y + pinned.height + MARGIN
    return { x: pinned.x, y, width: pinned.width, height: Math.max(above, below), area }
  }
  const left = pinned.x - MARGIN - MARGIN
  const right = area.width - MARGIN - (pinned.x + pinned.width + MARGIN)
  if (Math.max(left, right) < PANEL_MIN.width) return null
  const w = Math.min(width, Math.max(left, right))
  const x = left > right ? pinned.x - MARGIN - w : pinned.x + pinned.width + MARGIN
  return { x, y: PANEL_TOP, width: w, height: bottom - PANEL_TOP, area }
}

// Sem posição definida ainda, o painel nasce encostado à direita, na altura toda.
export function useFloatingRect(
  ref: RefObject<HTMLElement | null>,
  rect: PanelRect | null,
  onChange: (rect: PanelRect) => void,
  defaultWidth = PANEL_DEFAULT_WIDTH
) {
  useLayoutEffect(() => {
    if (rect) return
    const area = areaSize(ref.current)
    if (!area) return
    const width = Math.min(defaultWidth, area.width - MARGIN * 2)
    onChange({ x: area.width - MARGIN - width, y: PANEL_TOP, width, height: area.height - PANEL_TOP - MARGIN, area })
  }, [rect]) // eslint-disable-line react-hooks/exhaustive-deps

  // A área mudou de tamanho (janela redimensionada, outro monitor), com o painel aberto ou
  // enquanto estava fechado: reescala a partir do tamanho em que o rect foi definido.
  const rectRef = useRef(rect)
  rectRef.current = rect
  useLayoutEffect(() => {
    const el = ref.current?.parentElement
    if (!el) return
    const sync = () => {
      const current = rectRef.current
      const area = areaSize(ref.current)
      // Área zerada (janela minimizada, ainda montando): espera um tamanho de verdade.
      if (!current || !area || area.width === 0 || area.height === 0) return
      const from = current.area ?? area
      if (from.width === area.width && from.height === area.height) {
        if (!current.area) onChange({ ...current, area })
        return
      }
      onChange(rescale(current, from, area))
    }
    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(el)
    return () => observer.disconnect()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
          y: clamp(rect.y + dy, PANEL_TOP, max.bottom - rect.height),
          area
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
        y = clamp(rect.y + dy, PANEL_TOP, rect.y + rect.height - PANEL_MIN.height)
        height = rect.y + rect.height - y
      }
      if (edges.bottom) height = clamp(rect.height + dy, PANEL_MIN.height, max.bottom - rect.y)
      onChange({ x, y, width, height, area })
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
