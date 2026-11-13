import { useEffect, useState } from 'react'
import { isCanvasTarget } from './keyTargets'

// Espaço segurado = modo câmera: qualquer arraste move o canvas, nunca um bloco. Só com o foco no
// canvas; botões dentro do React Flow (zoom, recolher grupo) também viram câmera. Num modal, num
// drawer ou num campo, o espaço continua sendo deles.
export function useSpaceHeld(): boolean {
  const [held, setHeld] = useState(false)

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || !isCanvasTarget(e.target)) return
      // Evita que o espaço role a página ou "clique" o botão focado.
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
