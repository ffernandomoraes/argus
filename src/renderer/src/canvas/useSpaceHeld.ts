import { useEffect, useState } from 'react'

// Espaço segurado = modo câmera: qualquer arraste move o canvas, nunca um bloco.
export function useSpaceHeld(): boolean {
  const [held, setHeld] = useState(false)

  useEffect(() => {
    const isTyping = (e: KeyboardEvent) =>
      (e.target as HTMLElement).closest('input, textarea, [contenteditable="true"]') !== null

    const onDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || isTyping(e)) return
      // Evita que o espaço "clique" o botão focado ou role a página.
      e.preventDefault()
      setHeld(true)
    }
    const onUp = (e: KeyboardEvent) => e.code === 'Space' && setHeld(false)
    const reset = () => setHeld(false)

    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', reset)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', reset)
    }
  }, [])

  return held
}
