import { useCallback, useEffect, useRef, useState } from 'react'

export type DictationState = 'idle' | 'starting' | 'listening'

// Ditado pelo reconhecimento de fala do macOS. onText recebe o texto acumulado da fala
// (não só o pedaço novo), então quem usa decide onde encaixar.
export function useDictation(onText: (text: string) => void) {
  const [state, setState] = useState<DictationState>('idle')
  const [error, setError] = useState<{ message: string; action?: 'dictation-settings' } | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const onTextRef = useRef(onText)
  onTextRef.current = onText
  const active = useRef(false)

  useEffect(
    () =>
      window.api.speech.onEvent((e) => {
        if (!active.current) return
        if (e.type === 'ready') setState('listening')
        else if (e.type === 'warning') setWarning(e.message)
        else if (e.type === 'text') onTextRef.current(e.text)
        else if (e.type === 'error') {
          active.current = false
          setError({ message: e.message, action: e.action })
          setState('idle')
        } else if (e.type === 'done') {
          active.current = false
          setState('idle')
        }
      }),
    []
  )

  const start = useCallback(() => {
    setError(null)
    setWarning(null)
    setState('starting')
    active.current = true
    window.api.speech.start()
  }, [])

  const stop = useCallback(() => {
    window.api.speech.stop()
    active.current = false
    setState('idle')
  }, [])

  // Sair da conversa com o microfone ligado desliga o ditado.
  useEffect(() => () => {
    if (active.current) window.api.speech.stop()
  }, [])

  return { state, error, warning, start, stop, toggle: state === 'idle' ? start : stop }
}
