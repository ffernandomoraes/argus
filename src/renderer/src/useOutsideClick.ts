import { useEffect, useRef, type RefObject } from 'react'

// Menu aberto fecha com um clique em qualquer lugar fora dele, como no macOS. O ouvinte é na fase
// de captura, para valer mesmo onde o clique para no caminho (canvas, drawer). Clique dentro de um
// iframe ou webview (a tela do modo design, o navegador) não chega à janela: ela só perde o foco,
// e isso também fecha.
export function useOutsideClick(ref: RefObject<HTMLElement | null>, onOutside: () => void, enabled = true): void {
  const handler = useRef(onOutside)
  handler.current = onOutside
  useEffect(() => {
    if (!enabled) return
    const down = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) handler.current()
    }
    const blur = () => handler.current()
    window.addEventListener('mousedown', down, true)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('mousedown', down, true)
      window.removeEventListener('blur', blur)
    }
  }, [enabled, ref])
}
