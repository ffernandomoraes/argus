import type { PointerEvent as ReactPointerEvent } from 'react'
import { clampSideWidth, DEFAULT_SIDE_WIDTH, getSideWidth, setSideWidth } from './sideWidth'

// Alça na borda direita da coluna (que precisa ser `relative`). O ponteiro fica preso a ela durante
// o arrasto, para não se perder em cima da tela (iframe) ao lado. Enquanto arrasta, só a largura
// da própria coluna muda (no estilo dela): a conversa não redesenha a cada movimento. A largura
// vai para o store, e fica salva, ao soltar.
export function SideResizer() {
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    const handle = e.currentTarget
    const column = handle.parentElement
    handle.setPointerCapture(e.pointerId)
    const startX = e.clientX
    const startWidth = getSideWidth()
    let width = startWidth
    const move = (ev: PointerEvent) => {
      width = clampSideWidth(startWidth + ev.clientX - startX)
      if (column) column.style.width = `${width}px`
    }
    const up = () => {
      setSideWidth(width)
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', up)
      handle.removeEventListener('pointercancel', up)
      document.body.style.cursor = ''
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', up)
    handle.addEventListener('pointercancel', up)
    document.body.style.cursor = 'col-resize'
  }
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      title="Arraste para mudar a largura (dois cliques: volta ao padrão)"
      onPointerDown={onPointerDown}
      onDoubleClick={() => setSideWidth(DEFAULT_SIDE_WIDTH)}
      className="absolute -right-1 top-0 z-10 h-full w-2 cursor-col-resize after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-accent after:opacity-0 after:transition-opacity hover:after:opacity-100"
    />
  )
}
