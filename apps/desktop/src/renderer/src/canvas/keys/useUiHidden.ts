import { useCallback, useEffect, useState } from 'react'
import { isMod } from '../../platform'

// Interface oculta: só os blocos e a barra de título; as barras do canvas (navegação, zoom, uso)
// somem até clicar de novo no botão ou repetir ⌘\. Não fica salvo: reabrir o app volta com tudo.
export function useUiHidden(): { uiHidden: boolean; toggleUi: () => void } {
  const [uiHidden, setUiHidden] = useState(false)
  const toggleUi = useCallback(() => setUiHidden((h) => !h), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isMod(e) || e.shiftKey || e.altKey || (e.key !== '\\' && e.code !== 'Backslash')) return
      e.preventDefault()
      toggleUi()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleUi])

  return { uiHidden, toggleUi }
}
