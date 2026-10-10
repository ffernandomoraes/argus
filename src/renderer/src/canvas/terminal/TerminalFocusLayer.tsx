import type { ReactNode, Ref } from 'react'
import { createPortal } from 'react-dom'
import { TITLE_BAR_HEIGHT } from '../../conversation/FloatingPanel'
import { drawerZoomKey } from '../../conversation/useDrawerZoom'
import { IS_WIN } from '../../platform'

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation()

// Modo foco: o terminal cobre a área toda abaixo da barra de título, como a conversa no drawer.
// O bloco não sai do lugar no canvas; enquanto isso, o terminal mora só nesta camada. Trocar de
// lugar recria a tela do xterm, mas o processo é o mesmo e devolve o que já tinha escrito.
export function TerminalFocusLayer({ panelRef, children }: { panelRef: Ref<HTMLDivElement>; children: ReactNode }) {
  return createPortal(
    // Na captura: ⌘+ e ⌘- não chegam ao xterm nem ao zoom do canvas. No Mac, o Ctrl fica com
    // o programa (Ctrl+- desfaz no nano). O portal repassa os eventos ao bloco no canvas; os
    // de mouse param aqui (selecionar, menu do bloco).
    <div
      ref={panelRef}
      onKeyDownCapture={(e) => (IS_WIN || e.metaKey) && drawerZoomKey(e.nativeEvent) && e.stopPropagation()}
      onClick={stop}
      onDoubleClick={stop}
      onContextMenu={stop}
      onPointerDown={stop}
      onMouseDown={stop}
      className="fixed inset-x-0 bottom-0 z-40 flex flex-col bg-surface"
      style={{ top: TITLE_BAR_HEIGHT }}
    >
      {children}
    </div>,
    document.body
  )
}
