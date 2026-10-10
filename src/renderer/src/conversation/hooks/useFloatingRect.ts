import { useLayoutEffect, useRef, type PointerEvent, type RefObject } from 'react'
import { defaultRect, dragRect, PANEL_DEFAULT_WIDTH, rescale, type AreaSize, type Edges, type PanelRect } from '../panelGeometry'

// Painel flutuante com posição e tamanho livres dentro da área do canvas: arrasta pelo cabeçalho
// e redimensiona pelas quatro bordas e pelos cantos (ver ResizeHandles em FloatingPanel).

function areaSize(el: HTMLElement | null): AreaSize | null {
  const area = el?.parentElement
  return area ? { width: area.clientWidth, height: area.clientHeight } : null
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
    if (area) onChange(defaultRect(area, defaultWidth))
  }, [rect]) // eslint-disable-line react-hooks/exhaustive-deps

  // A área mudou de tamanho (janela redimensionada, outro monitor), com o painel aberto ou
  // enquanto estava fechado: reescala a partir do tamanho em que o rect foi definido. O rect vai
  // por ref (atualizado antes do efeito abaixo), para o observador não ser refeito a cada mudança.
  const rectRef = useRef(rect)
  useLayoutEffect(() => {
    rectRef.current = rect
  })
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
    const handle = e.currentTarget as HTMLElement
    const pointer = { x: e.clientX, y: e.clientY }

    const onMove = (ev: globalThis.PointerEvent) => onChange(dragRect(rect, edges, ev.clientX - pointer.x, ev.clientY - pointer.y, area))
    // Termina ao soltar e também quando o sistema toma o ponteiro (pointercancel, captura perdida):
    // no Windows, com toque, caneta ou um diálogo do sistema no meio, o pointerup pode não vir, e o
    // painel seguia o mouse depois de solto.
    const end = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      handle.removeEventListener('lostpointercapture', end)
      document.body.style.cursor = ''
    }
    document.body.style.cursor = getComputedStyle(handle).cursor
    // Com a captura, o arraste segue mesmo com o ponteiro fora da janela.
    try {
      handle.setPointerCapture(e.pointerId)
    } catch {
      // Ponteiro que já não existe: os ouvintes da janela bastam.
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    handle.addEventListener('lostpointercapture', end)
  }

  return {
    onMoveStart: (e: PointerEvent) => begin(e, 'move'),
    onResizeStart: (edges: Edges) => (e: PointerEvent) => begin(e, edges)
  }
}
