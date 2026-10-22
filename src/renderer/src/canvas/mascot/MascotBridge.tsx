import { useEffect, useState } from 'react'
import { usePreference } from '../../settings/preferences'

// O mascote vive numa janela própria, solta na tela, por cima de qualquer app (ver
// src/main/app/mascotOverlay.ts e MascotOverlay). As janelas do app só avisam o processo principal
// se ele está ligado (a preferência fica aqui, no localStorage) e se alguém está escrevendo um
// pedido nesta janela (ele escuta com a mão na orelha). O resto ele lê sozinho.

// Depois da última tecla, ainda conta como escrevendo.
const TYPING_MS = 1500

export function MascotBridge() {
  const on = usePreference('mascot')
  const typing = useTyping()
  useEffect(() => window.api.mascot.setEnabled(on), [on])
  useEffect(() => {
    if (on) window.api.mascot.setTyping(typing)
  }, [on, typing])
  return null
}

// Alguém digitando num campo de texto longo (caixa do chat, terminal) nesta janela.
function useTyping(): boolean {
  const [typing, setTyping] = useState(false)
  useEffect(() => {
    let timer = 0
    const onInput = (e: Event) => {
      if (!(e.target instanceof HTMLTextAreaElement)) return
      setTyping(true)
      clearTimeout(timer)
      timer = window.setTimeout(() => setTyping(false), TYPING_MS)
    }
    document.addEventListener('input', onInput, true)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('input', onInput, true)
    }
  }, [])
  return typing
}
