import { useSyncExternalStore, type PointerEvent as ReactPointerEvent } from 'react'

// Largura da coluna do chat no modo design, lembrada entre
// aberturas. Arrasta pela borda direita da coluna; dois cliques voltam ao padrão.
const KEY = 'argus.design.sideWidth'
const DEFAULT = 460
const MIN = 300
// Sobra sempre espaço para a tela ao lado.
const max = () => Math.max(MIN, Math.round(window.innerWidth * 0.6))
const clamp = (w: number) => Math.min(max(), Math.max(MIN, Math.round(w)))

let width = (() => {
  try {
    const saved = Number(localStorage.getItem(KEY))
    return saved ? clamp(saved) : DEFAULT
  } catch {
    return DEFAULT
  }
})()
const listeners = new Set<() => void>()

function setWidth(next: number, save: boolean): void {
  width = clamp(next)
  listeners.forEach((l) => l())
  if (!save) return
  try {
    localStorage.setItem(KEY, String(width))
  } catch {
    // Sem armazenamento: vale até fechar o app.
  }
}

export function useSideWidth(): number {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => Math.min(width, max())
  )
}

// Alça na borda direita da coluna (que precisa ser `relative`). O ponteiro fica preso a ela durante
// o arrasto, para não se perder em cima da tela (iframe) ao lado.
export function SideResizer() {
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    const handle = e.currentTarget
    handle.setPointerCapture(e.pointerId)
    const startX = e.clientX
    const startWidth = width
    const move = (ev: PointerEvent) => setWidth(startWidth + ev.clientX - startX, false)
    const up = () => {
      setWidth(width, true)
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
      onDoubleClick={() => setWidth(DEFAULT, true)}
      className="absolute -right-1 top-0 z-10 h-full w-2 cursor-col-resize after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-accent after:opacity-0 after:transition-opacity hover:after:opacity-100"
    />
  )
}
