import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { flushSync } from 'react-dom'
import { MOTION, reduced } from '../../motion'

// Troca do modo foco com o efeito padrão (motion.tsx): o painel some, o layout troca enquanto
// ele está invisível, e ele volta no novo tamanho. Esticar a largura deixava o texto se
// rearrumando na frente de quem lê.
const HIDDEN = { opacity: 0, transform: MOTION.panel.to }
const SHOWN = { opacity: 1, transform: 'none' }

// Modo foco do drawer: ligado ou não, e a troca animada. setFocus é fixo e ignora pedidos no meio
// de uma troca.
export function useFocusMode(panelRef: RefObject<HTMLElement | null>): [boolean, (on: boolean) => Promise<void>] {
  const [focus, setFocusNow] = useState(false)
  const current = useRef(false)
  const switching = useRef(false)
  useLayoutEffect(() => {
    current.current = focus
  })

  const setFocus = useCallback(
    async (on: boolean) => {
      const panel = panelRef.current
      if (on === current.current || switching.current) return
      if (!panel || reduced()) return setFocusNow(on)
      switching.current = true
      const out = panel.animate([SHOWN, HIDDEN], { ...MOTION.panel.out, fill: 'forwards' })
      await out.finished.catch(() => {})
      flushSync(() => setFocusNow(on))
      // O fade de entrada começa já no estado escondido, então tirar o de saída não pisca.
      const enter = panel.animate([{ opacity: 0, transform: MOTION.panel.from }, SHOWN], MOTION.panel.in)
      out.cancel()
      await enter.finished.catch(() => {})
      switching.current = false
    },
    [panelRef]
  )

  return [focus, setFocus]
}
