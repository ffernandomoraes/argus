import { useCallback, useEffect, useRef, useState, type RefObject, type KeyboardEvent, type PointerEvent, type UIEvent, type WheelEvent } from 'react'
import { scrollWithin } from '../scrollWithin'

const UP_KEYS = new Set(['ArrowUp', 'PageUp', 'Home'])
// Por quanto tempo depois de roda, tecla ou toque uma rolagem ainda conta como sua.
const INTENT_MS = 1000
// Quanto dura o acerto ao abrir a conversa (ver settle).
const SETTLE_MS = 1500

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
  // Quando você mexeu na rolagem por último (roda, tecla, toque, clique) e se o botão segue apertado
  // (arrastando a barra de rolagem).
  const intentAt = useRef(-Infinity)
  const pressing = useRef(false)
  const markIntent = () => {
    intentAt.current = performance.now()
  }
  const yours = () => pressing.current || performance.now() - intentAt.current < INTENT_MS

  const toEnd = useCallback(() => {
    const el = scrollerRef.current
    if (el && following.current) el.scrollTop = el.scrollHeight
  }, [scrollerRef])

  // Ao enviar: volta a seguir o fim.
  const follow = useCallback(() => {
    following.current = true
    toEnd()
  }, [toEnd])

  // Ao abrir a conversa (o histórico chegou, ou ela foi aberta de novo já estando à vista): segue o
  // fim e, por um instante, volta para ele a cada quadro. Nesse começo o histórico entra de uma vez
  // e a lista virtualizada mede os itens e corrige a rolagem várias vezes; só pelos avisos de
  // rolagem e de tamanho, às vezes a conversa abria no meio, longe da última resposta (mais no
  // Windows). Subir para ler solta o fim (following) e o acerto para na hora.
  // Devolve a função que cancela.
  const settle = useCallback(() => {
    following.current = true
    const until = performance.now() + SETTLE_MS
    let frame = 0
    const step = () => {
      if (!following.current || performance.now() > until) return
      toEnd()
      frame = requestAnimationFrame(step)
    }
    step()
    return () => cancelAnimationFrame(frame)
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
  // A área da conversa encolhendo também conta (a sugestão abrindo embaixo dela, a caixa de
  // escrever crescendo): a rolagem não muda sozinha e o fim da resposta ficava escondido.
  useEffect(() => {
    const inner = contentRef.current
    if (!inner) return
    const observer = new ResizeObserver(() => {
      toEnd()
      if (!following.current) findPinned()
    })
    observer.observe(inner)
    if (scrollerRef.current) observer.observe(scrollerRef.current)
    return () => observer.disconnect()
  }, [contentRef, scrollerRef, toEnd, findPinned])

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
    } else if (following.current && !yours()) {
      // Seguindo o fim e a rolagem saiu dele sem você mexer: é a lista virtualizada corrigindo a
      // posição ao medir um item (às vezes um quadro depois de o conteúdo mudar, sem nova mudança de
      // tamanho para o observer). Antes isso soltava o fim e o "Pensando…" ficava abaixo da tela.
      toEnd()
      return
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
    markIntent()
    if (e.deltaY < 0 && e.currentTarget.scrollTop > 0) following.current = false
  }

  // Subir pelo teclado ou arrastando a barra de rolagem também solta na hora: o evento de rolagem
  // chega um quadro depois, e nesse meio a resposta crescendo puxava de volta para o fim.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    markIntent()
    if (UP_KEYS.has(e.key)) following.current = false
  }
  // Clique também conta: um link para outro ponto da resposta rola a conversa (scrollWithin).
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    markIntent()
    pressing.current = true
    const release = () => {
      pressing.current = false
      markIntent()
    }
    window.addEventListener('pointerup', release, { once: true })
    window.addEventListener('pointercancel', release, { once: true })
    const el = e.currentTarget
    if (e.nativeEvent.offsetX >= el.clientWidth && el.scrollTop > 0) following.current = false
  }

  // Toque na tela (Windows com tela sensível ao toque) não gera evento de roda.
  const onTouchMove = markIntent

  // Balão montado: rola suave até ele. Fora da tela (não montado): a linha do tempo leva até lá.
  const scrollToPrompt = () => {
    if (!pinnedKey) return
    following.current = false
    markIntent()
    const el = scrollerRef.current?.querySelector(`[data-prompt="${CSS.escape(pinnedKey)}"]`)
    if (el) scrollWithin(el, 'start')
    else timeline.scrollToKey(pinnedKey)
  }

  return { onScroll, onWheel, onKeyDown, onPointerDown, onTouchMove, toEnd, follow, settle, pinnedKey, scrollingUp, keepShown, hideSoon, scrollToPrompt }
}
