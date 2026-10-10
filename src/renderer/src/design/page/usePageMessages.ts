import { useEffect, useEffectEvent, type RefObject } from 'react'
import { parsePageMessage, type PageMessage } from './pageMessages'

// Avisos da página do protótipo. Só contam os que vêm do quadro da página e da origem dela (a do
// servidor local, onde o app põe os scripts): outra janela, ou outro site aberto dentro do quadro,
// não fala com o app por aqui.
const LOCAL = new Set(['localhost', '127.0.0.1'])

// localhost e 127.0.0.1 na mesma porta são o mesmo servidor: o servidor do protótipo pode
// redirecionar de um para o outro.
function sameServer(a: string, b: string): boolean {
  if (a === b) return true
  try {
    const x = new URL(a)
    const y = new URL(b)
    return x.protocol === y.protocol && x.port === y.port && LOCAL.has(x.hostname) && LOCAL.has(y.hostname)
  } catch {
    return false
  }
}

export function usePageMessages(
  frameRef: RefObject<HTMLIFrameElement | null>,
  origin: string | null,
  onMessage: (message: PageMessage) => void
): void {
  const handle = useEffectEvent((e: MessageEvent) => {
    if (!origin || !sameServer(e.origin, origin)) return
    const message = parsePageMessage(e.data, origin)
    if (message) onMessage(message)
  })
  useEffect(() => {
    const listener = (e: MessageEvent) => {
      const frame = frameRef.current
      if (frame && e.source === frame.contentWindow) handle(e)
    }
    window.addEventListener('message', listener)
    return () => window.removeEventListener('message', listener)
  }, [frameRef])
}
