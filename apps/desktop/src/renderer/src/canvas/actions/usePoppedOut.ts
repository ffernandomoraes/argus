import { useCallback, useEffect } from 'react'
import type { CanvasViewStore } from '../canvasView'

// Conversas abertas em janela separada, no store do canvas (lidas por bloco em useCanvasView). A
// janela fechada sai da lista. Devolve a função que marca uma conversa como aberta em janela.
export function usePoppedOut(view: CanvasViewStore): (id: string) => void {
  useEffect(
    () =>
      window.api.popout.onClosed((id) =>
        view.set((s) => {
          if (!s.poppedOut.has(id)) return s
          const poppedOut = new Set(s.poppedOut)
          poppedOut.delete(id)
          return { ...s, poppedOut }
        })
      ),
    [view]
  )

  return useCallback(
    (id: string) => view.set((s) => (s.poppedOut.has(id) ? s : { ...s, poppedOut: new Set(s.poppedOut).add(id) })),
    [view]
  )
}
