import { useCallback, useEffect, useRef, useState } from 'react'

export type DictationState = 'idle' | 'starting' | 'listening'

// Ditado (transcrição do Claude, ou do macOS na falta dela). onText recebe o texto acumulado da fala
// (não só o pedaço novo), então quem usa decide onde encaixar.
export function useDictation(onText: (text: string) => void) {
  const [state, setState] = useState<DictationState>('idle')
  const [error, setError] = useState<{ message: string; action?: 'dictation-settings' } | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const onTextRef = useRef(onText)
  onTextRef.current = onText
  // flushing: já parou de gravar, mas o fim do texto ainda pode chegar.
  const active = useRef<'off' | 'on' | 'flushing'>('off')

  useEffect(
    () =>
      window.api.speech.onEvent((e) => {
        if (active.current === 'off') return
        if (e.type === 'ready') {
          if (active.current === 'on') setState('listening')
        } else if (e.type === 'warning') setWarning(e.message)
        else if (e.type === 'text') onTextRef.current(e.text)
        else if (e.type === 'error') {
          active.current = 'off'
          setError({ message: e.message, action: e.action })
          setState('idle')
        } else if (e.type === 'done') {
          if (active.current === 'on') setState('idle')
          active.current = 'off'
        }
      }),
    []
  )

  const start = useCallback(() => {
    setError(null)
    setWarning(null)
    setState('starting')
    active.current = 'on'
    window.api.speech.start()
  }, [])

  // flush: as últimas palavras, que o serviço entrega logo depois de parar, ainda entram no
  // campo (até o "done"). Sem flush (ex.: ao enviar a mensagem), o que chegar é descartado.
  const stop = useCallback((flush = false) => {
    window.api.speech.stop()
    active.current = flush ? 'flushing' : 'off'
    setState('idle')
  }, [])

  // Sair da conversa com o microfone ligado desliga o ditado.
  useEffect(() => () => {
    if (active.current === 'on') window.api.speech.stop()
  }, [])

  return { state, error, warning, start, stop, toggle: state === 'idle' ? start : () => stop(true) }
}
