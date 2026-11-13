import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { MOTION, reduced } from '../../motion'
import { useEscape } from '../../useEscape'

// Modo foco do terminal: a camada de cima (em `panelRef`) entra e sai com o efeito dos painéis.
// Esc sai, mas só com o foco fora do terminal (no cabeçalho): dentro dele, o Esc é do programa
// (ver useEscape).
export function useFocusMode(panelRef: RefObject<HTMLElement | null>): {
  active: boolean
  enter: () => void
  exit: () => void
} {
  const [active, setActive] = useState(false)
  const leaving = useRef(false)

  useLayoutEffect(() => {
    if (!active || reduced()) return
    panelRef.current?.animate([{ opacity: 0, transform: MOTION.panel.from }, { opacity: 1, transform: 'none' }], MOTION.panel.in)
  }, [active, panelRef])

  const enter = useCallback(() => setActive(true), [])
  const exit = useCallback(() => {
    const panel = panelRef.current
    if (leaving.current) return
    if (!panel || reduced()) {
      setActive(false)
      return
    }
    leaving.current = true
    const out = panel.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: MOTION.panel.to }], {
      ...MOTION.panel.out,
      fill: 'forwards'
    })
    const done = () => {
      leaving.current = false
      setActive(false)
    }
    out.finished.then(done, done)
  }, [panelRef])
  useEscape(exit, active)

  return { active, enter, exit }
}
