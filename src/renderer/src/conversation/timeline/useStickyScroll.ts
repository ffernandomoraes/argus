import { useCallback, useEffect, useRef, useState, type RefObject, type UIEvent, type WheelEvent } from 'react'
import { scrollWithin } from '../scrollWithin'

// Rolagem da conversa: segue o fim quando chega coisa nova (a menos que a pessoa tenha subido para
// ler) e acha o prompt do trecho na tela, que fica preso no topo enquanto ela rola para cima.
// Os refs são de quem chama (o nome com Ref: o React Compiler reconhece que são refs).
export function useStickyScroll(scrollerRef: RefObject<HTMLDivElement | null>, contentRef: RefObject<HTMLDivElement | null>) {
  const following = useRef(true)
  const lastTop = useRef(0)
  const [pinnedKey, setPinnedKey] = useState<string | null>(null)
  const [scrollingUp, setScrollingUp] = useState(false)
  const travel = useRef({ distance: 0, at: 0 })
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const toEnd = useCallback(() => {
    const el = scrollerRef.current
    if (el && following.current) el.scrollTop = el.scrollHeight
  }, [scrollerRef])

  // Ao enviar: volta a seguir o fim.
  const follow = useCallback(() => {
    following.current = true
    toEnd()
  }, [toEnd])

  // Prompt do trecho que está na tela fica preso no topo: o último cujo balão já subiu para
  // fora da área visível. Rolando para trás, troca para o prompt daquele ponto do histórico.
  const findPinned = useCallback(() => {
    const root = scrollerRef.current
    if (!root) return
    const top = root.getBoundingClientRect().top + 8
    let key: string | null = null
    for (const el of root.querySelectorAll<HTMLElement>('[data-prompt]')) {
      if (el.getBoundingClientRect().bottom > top) break
      key = el.dataset.prompt ?? null
    }
    setPinnedKey(key)
  }, [scrollerRef])

  // Mensagem fora da tela começa com altura estimada (.timeline-item) e cresce ao aparecer.
  // Grudado no fim, acompanha esse crescimento para não parar no meio da última resposta.
  useEffect(() => {
    const inner = contentRef.current
    if (!inner) return
    const observer = new ResizeObserver(() => {
      toEnd()
      findPinned()
    })
    observer.observe(inner)
    return () => observer.disconnect()
  }, [contentRef, toEnd, findPinned])

  // O prompt preso só aparece rolando para cima. Rolando para baixo some; parado, some depois
  // de um instante (dá tempo de clicar nele; com o mouse em cima, fica). Só conta como
  // rolagem num sentido depois de ~60px seguidos nele: um tremido do trackpad não mexe.
  const hideSoon = useCallback(() => {
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setScrollingUp(false), 1200)
  }, [])
  const keepShown = useCallback(() => clearTimeout(hideTimer.current), [])
  useEffect(() => () => clearTimeout(hideTimer.current), [])

  const trackDirection = (delta: number) => {
    const now = performance.now()
    const t = travel.current
    // Mudou de sentido ou ficou parado um pouco: começa a contar de novo.
    t.distance = Math.sign(delta) !== Math.sign(t.distance) || now - t.at > 300 ? delta : t.distance + delta
    t.at = now
    if (t.distance <= -60) {
      setScrollingUp(true)
      hideSoon()
    } else if (t.distance >= 60) {
      clearTimeout(hideTimer.current)
      setScrollingUp(false)
    }
  }

  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const delta = el.scrollTop - lastTop.current
    lastTop.current = el.scrollTop
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    // No fim (também quando o conteúdo encolhe e puxa a rolagem): segue. Qualquer subida solta na
    // hora; antes, só passar de 40px do fim soltava, e cada atualização puxava de volta.
    // Parar no fim não é rolar para cima, mesmo que a rolagem tenha voltado: ao enviar, a caixa de
    // escrever encolhe e a área da conversa cresce, o navegador puxa a rolagem uns pixels para
    // trás, e o prompt preso aparecia e sumia.
    if (distance <= 1) {
      following.current = true
      travel.current.distance = 0
      clearTimeout(hideTimer.current)
      setScrollingUp(false)
    } else {
      if (delta < 0) following.current = false
      else if (distance < 40) following.current = true
      trackDirection(delta)
    }
    findPinned()
  }

  // Roda do mouse ou trackpad para cima solta antes mesmo de a rolagem acontecer (sem rolagem
  // possível, não solta: a conversa curta continua seguindo o fim quando crescer).
  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    if (e.deltaY < 0 && e.currentTarget.scrollTop > 0) following.current = false
  }

  const scrollToPrompt = () => {
    const el = scrollerRef.current?.querySelector(`[data-prompt="${CSS.escape(pinnedKey ?? '')}"]`)
    if (el) scrollWithin(el, 'start')
  }

  return { onScroll, onWheel, toEnd, follow, pinnedKey, scrollingUp, keepShown, hideSoon, scrollToPrompt }
}
