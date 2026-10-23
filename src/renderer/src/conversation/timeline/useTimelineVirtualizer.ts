import { useCallback, useLayoutEffect, useState, type RefObject } from 'react'
import { useVirtualizer, type Rect, type Virtualizer } from '@tanstack/react-virtual'
import type { TimelineItem } from './timelineItem'

// Altura de um item antes de ser medido, em px do layout (uma resposta curta, uma ação). Os
// maiores corrigem sozinhos ao aparecer, sem mexer no que você está vendo.
const ESTIMATE = 96
// Itens montados além da tela, em cima e embaixo: rolar rápido não mostra buraco.
const OVERSCAN = 8

export type TimelineVirtualizer = Virtualizer<HTMLDivElement, HTMLDivElement>

// Tamanho da área de rolagem em px do layout (clientWidth/clientHeight), a mesma unidade do
// scrollTop. O padrão da biblioteca lê o getBoundingClientRect, que já vem com o zoom do drawer
// (CSS zoom) e o do canvas (transform) aplicados: com zoom fora de 1, a conta da rolagem errava.
// A largura mudou (o zoom do drawer, a borda do painel): o texto quebra em outro lugar e as alturas
// medidas antes não valem mais, então mede tudo de novo.
function observeLayoutRect(instance: TimelineVirtualizer, cb: (rect: Rect) => void): (() => void) | undefined {
  const el = instance.scrollElement
  if (!el) return
  let width = el.clientWidth
  cb({ width, height: el.clientHeight })
  const observer = new ResizeObserver(() => {
    if (el.clientWidth !== width) {
      width = el.clientWidth
      instance.measure()
    }
    cb({ width, height: el.clientHeight })
  })
  observer.observe(el)
  return () => observer.disconnect()
}

// Altura do item em px do layout (offsetHeight), pelo mesmo motivo. Num redesenho sem aviso de
// mudança de tamanho, fica a medida guardada (ler o offsetHeight a cada redesenho forçaria o layout).
function measureLayout(el: HTMLDivElement, entry: ResizeObserverEntry | undefined, instance: TimelineVirtualizer): number {
  if (!entry) {
    const cached = instance.itemSizeCache.get(instance.options.getItemKey(instance.indexFromElement(el)))
    if (cached !== undefined) return cached
  }
  return el.offsetHeight
}

// A linha do tempo virtualizada: só os itens perto da tela ficam montados. Ao entrar item em cima
// (as mensagens anteriores), quem você lia continua no lugar (anchorTo 'end'); seguir o fim ao
// chegar coisa nova fica com o useStickyScroll. `list`: o elemento da lista, dentro da área.
// `placeholder`: o "Carregando conversa" acima dela muda onde a lista começa.
export function useTimelineVirtualizer(
  scroller: HTMLDivElement | null,
  list: RefObject<HTMLDivElement | null>,
  rows: TimelineItem[],
  placeholder: boolean
): TimelineVirtualizer {
  // Onde a lista começa dentro da área de rolagem (o respiro de cima, o "Carregando conversa").
  const [margin, setMargin] = useState(0)
  useLayoutEffect(() => {
    const top = list.current?.offsetTop ?? 0
    if (top !== margin) setMargin(top)
  }, [list, scroller, placeholder, margin])

  const getItemKey = useCallback((index: number) => rows[index]?.key ?? index, [rows])
  return useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroller,
    enabled: scroller !== null,
    estimateSize: () => ESTIMATE,
    getItemKey,
    overscan: OVERSCAN,
    scrollMargin: margin,
    // Abre no fim: monta as últimas, e não as primeiras para depois pular. Desconta a altura da área
    // para as que enchem a tela estarem entre as montadas (no modo foco ela é alta).
    initialOffset: () => Math.max(0, rows.length * ESTIMATE + margin - (scroller?.clientHeight ?? 0)),
    anchorTo: 'end',
    observeElementRect: observeLayoutRect,
    measureElement: measureLayout
  })
}
