import { useCallback, useEffect, useRef, useState, type RefObject, type KeyboardEvent, type PointerEvent, type UIEvent, type WheelEvent } from 'react'
import { scrollWithin } from '../scrollWithin'

const UP_KEYS = new Set(['ArrowUp', 'PageUp', 'Home'])

// Rolagem da conversa: segue o fim quando chega coisa nova (a menos que a pessoa tenha subido para
// ler) e acha o prompt do trecho na tela, que fica preso no topo enquanto ela rola para cima.
// Os refs são de quem chama (o nome com Ref: o React Compiler reconhece que são refs). A conversa é
// virtualizada (Timeline): só os itens perto da tela estão montados, então quem diz qual balão vem
// antes de um item e como rolar até um que não está montado é a linha do tempo (`timeline`).
export type StickyTimeline = {
  // O último balão seu antes do item `index` (data-index); nulo se não houver.
  promptBefore: (index: number) => string | null
  scrollToKey: (key: string) => void
}

export function useStickyScroll(
  scrollerRef: RefObject<HTMLDivElement | null>,
  contentRef: RefObject<HTMLDivElement | null>,
  timeline: StickyTimeline
) {
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
  // fora da área visível. Rolando para trás, troca para o prompt daquele ponto do histórico. Acha o
  // primeiro item à vista; o balão vem antes dele, montado ou não.
  const { promptBefore } = timeline
  const findPinned = useCallback(() => {
    const root = scrollerRef.current
    if (!root) return
    const top = root.getBoundingClientRect().top + 8
    for (const el of root.querySelectorAll<HTMLElement>('[data-index]')) {
      if (el.getBoundingClientRect().bottom > top) return setPinnedKey(promptBefore(Number(el.dataset.index)))
    }
    setPinnedKey(null)
  }, [scrollerRef, promptBefore])

  // Item fora da tela começa com altura estimada (useTimelineVirtualizer) e cresce ao ser medido.
  // Grudado no fim, acompanha esse crescimento para não parar no meio da última resposta.
  // Seguindo o fim, o prompt preso não aparece (só rolando para cima, e aí o onScroll o acha): a
  // busca, que mede cada item, fica de fora enquanto a resposta cresce, ~20 vezes por segundo.
  useEffect(() => {
    const inner = contentRef.current
    if (!inner) return
    const observer = new ResizeObserver(() => {
      toEnd()
      if (!following.current) findPinned()
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
    // Só volta a seguir quem desceu até o fim. Rolagem que voltou porque o conteúdo encolheu
    // (a resposta terminou: a linha de "trabalhando" sai e a prévia vira a mensagem gravada) não
    // é a pessoa chegando ao fim: quem tinha subido para ler continua onde estava.
    if (distance <= 1) {
      if (delta >= 0) following.current = true
      travel.current.distance = 0
      clearTimeout(hideTimer.current)
      setScrollingUp(false)
    } else {
      if (delta < 0) following.current = false
      else if (distance < 40) following.current = true
      trackDirection(delta)
    }
    // Rolagem feita pelo toEnd, no fim e seguindo: o prompt preso não está à vista (ver o observer).
    if (!(following.current && distance <= 1)) findPinned()
  }

  // Roda do mouse ou trackpad para cima solta antes mesmo de a rolagem acontecer (sem rolagem
  // possível, não solta: a conversa curta continua seguindo o fim quando crescer).
  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    if (e.deltaY < 0 && e.currentTarget.scrollTop > 0) following.current = false
  }

  // Subir pelo teclado ou arrastando a barra de rolagem também solta na hora: o evento de rolagem
  // chega um quadro depois, e nesse meio a resposta crescendo puxava de volta para o fim.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (UP_KEYS.has(e.key)) following.current = false
  }
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    if (e.nativeEvent.offsetX >= el.clientWidth && el.scrollTop > 0) following.current = false
  }

  // Balão montado: rola suave até ele. Fora da tela (não montado): a linha do tempo leva até lá.
  const scrollToPrompt = () => {
    if (!pinnedKey) return
    const el = scrollerRef.current?.querySelector(`[data-prompt="${CSS.escape(pinnedKey)}"]`)
    if (el) scrollWithin(el, 'start')
    else timeline.scrollToKey(pinnedKey)
  }

  return { onScroll, onWheel, onKeyDown, onPointerDown, toEnd, follow, pinnedKey, scrollingUp, keepShown, hideSoon, scrollToPrompt }
}
