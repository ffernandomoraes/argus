import { useEffect } from 'react'
import { IS_MAC } from '../../platform'

// Outra janela do mesmo canvas, para levar a outro monitor. No Mac o ⇧⌘N vem pelo menu Arquivo;
// no Windows e no Linux, sem menu, a tecla (Ctrl+Shift+N) é tratada aqui.
export function useNewWindowShortcut(): void {
  useEffect(() => {
    if (IS_MAC) return
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey || !e.shiftKey || e.altKey || e.key.toLowerCase() !== 'n') return
      e.preventDefault()
      window.api.canvas.newWindow()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
