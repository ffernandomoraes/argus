// Fim do arraste: soltar, o sistema tomar o ponteiro (pointercancel: gesto do trackpad, troca de
// janela) ou a captura sumir. Antes só o pointerup contava, e os ouvintes ficavam presos no
// puxador quando o arraste acabava de outro jeito.
const END = ['pointerup', 'pointercancel', 'lostpointercapture'] as const

type DragStart = { currentTarget: EventTarget; pointerId: number; clientX: number }

// Arraste horizontal preso ao puxador (pointer capture). `onMove` recebe o deslocamento desde o
// início, em pixels da tela, a cada movimento; `onEnd`, o último deslocamento, uma vez só.
export function trackPointerDrag(
  e: DragStart,
  { onMove, onEnd }: { onMove: (dx: number) => void; onEnd: (dx: number) => void }
): void {
  const handle = e.currentTarget as HTMLElement
  handle.setPointerCapture(e.pointerId)
  const startX = e.clientX
  let dx = 0
  const move = (ev: PointerEvent) => {
    dx = ev.clientX - startX
    onMove(dx)
  }
  const end = () => {
    handle.removeEventListener('pointermove', move)
    for (const type of END) handle.removeEventListener(type, end)
    onEnd(dx)
  }
  handle.addEventListener('pointermove', move)
  for (const type of END) handle.addEventListener(type, end)
}
