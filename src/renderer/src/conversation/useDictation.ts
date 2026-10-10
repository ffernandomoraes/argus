import { useCallback, useEffect, useEffectEvent, useState } from 'react'
import {
  claimDictation,
  createDictationSession,
  listensToDictation,
  releaseDictation,
  setDictationPhase
} from './dictationOwner'

export type DictationState = 'idle' | 'starting' | 'listening'

// Ditado (transcrição do Claude, ou do macOS na falta dela). onText recebe o texto acumulado da fala
// (não só o pedaço novo), então quem usa decide onde encaixar. Um campo por vez recebe o texto: o
// que começou por último (ver dictationOwner).
export function useDictation(onText: (text: string) => void) {
  const [state, setState] = useState<DictationState>('idle')
  const [error, setError] = useState<{ message: string; action?: 'dictation-settings' } | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [session] = useState(() => createDictationSession(() => setState('idle')))
  const text = useEffectEvent((spoken: string) => onText(spoken))

  useEffect(
    () =>
      window.api.speech.onEvent((e) => {
        if (!listensToDictation(session)) return
        if (e.type === 'ready') {
          if (session.phase === 'on') setState('listening')
        } else if (e.type === 'warning') setWarning(e.message)
        else if (e.type === 'text') text(e.text)
        else if (e.type === 'error') {
          setDictationPhase(session, 'off')
          setError({ message: e.message, action: e.action })
          setState('idle')
        } else if (e.type === 'done') {
          if (session.phase === 'on') setState('idle')
          setDictationPhase(session, 'off')
        }
      }),
    [session]
  )

  const start = useCallback(() => {
    setError(null)
    setWarning(null)
    setState('starting')
    claimDictation(session)
    window.api.speech.start()
  }, [session])

  // flush: as últimas palavras, que o serviço entrega logo depois de parar, ainda entram no
  // campo (até o "done"). Sem flush (ex.: ao enviar a mensagem), o que chegar é descartado.
  const stop = useCallback(
    (flush = false) => {
      window.api.speech.stop()
      setDictationPhase(session, flush ? 'flushing' : 'off')
      setState('idle')
    },
    [session]
  )

  // Sair da conversa com o microfone ligado desliga o ditado.
  useEffect(
    () => () => {
      if (releaseDictation(session)) window.api.speech.stop()
    },
    [session]
  )

  return { state, error, warning, start, stop, toggle: state === 'idle' ? start : () => stop(true) }
}
