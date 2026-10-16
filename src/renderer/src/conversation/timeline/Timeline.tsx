import { memo, useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import { Step } from './rows/Step'
import type { TimelineItem } from './timelineItem'
import { useTimelineVirtualizer } from './useTimelineVirtualizer'

export type TimelineHandle = {
  // Rola até o item, mesmo fora da tela (e por isso sem estar montado).
  scrollToKey(key: string): void
}

// A conversa desenhada: balões e divisores soltos, passos do Claude com a bolinha e a linha que
// desce até o próximo passo (mensagem sua interrompe a linha do tempo). Virtualizada: só os itens
// perto da tela ficam montados, com o espaço dos outros em cima e embaixo (useTimelineVirtualizer).
// data-index marca cada item na lista (para medir e para o prompt preso no topo, useStickyScroll);
// data-prompt, os balões.
// Passo novo entra com um fade subindo de leve; os que já estavam quando a conversa abriu (ou o
// histórico chegou de uma vez) aparecem parados, para não animar a conversa inteira. As anteriores
// carregadas ao rolar para cima também: só anima o que vem depois do último que já estava, e uma
// vez só (voltar à tela depois de rolar não anima de novo).
export const Timeline = memo(function Timeline({
  rows,
  scroller,
  placeholder,
  handle
}: {
  rows: TimelineItem[]
  // A área de rolagem da conversa; nula até ela montar.
  scroller: HTMLDivElement | null
  // O "Carregando conversa" está acima da lista.
  placeholder: boolean
  handle: Ref<TimelineHandle>
}) {
  const list = useRef<HTMLDivElement>(null)
  const virtualizer = useTimelineVirtualizer(scroller, list, rows, placeholder)
  useImperativeHandle(
    handle,
    () => ({
      scrollToKey(key) {
        const index = rows.findIndex((row) => row.key === key)
        if (index >= 0) virtualizer.scrollToIndex(index, { align: 'start' })
      }
    }),
    [rows, virtualizer]
  )

  const initial = useRef<Set<string> | null>(null)
  if (!initial.current && rows.length) initial.current = new Set(rows.map((row) => row.key))
  let lastInitial = rows.length - 1
  while (lastInitial >= 0 && !initial.current?.has(rows[lastInitial].key)) lastInitial--
  // Os que já chegaram, na tela ou fora dela (você tinha subido para ler).
  const entered = useRef(new Set<string>())
  useEffect(() => {
    for (let i = lastInitial + 1; i < rows.length; i++) entered.current.add(rows[i].key)
  })

  const items = virtualizer.getVirtualItems()
  const margin = virtualizer.options.scrollMargin
  const before = items.length ? items[0].start - margin : 0
  const after = items.length ? Math.max(0, virtualizer.getTotalSize() - (items[items.length - 1].end - margin)) : 0
  return (
    <div ref={list} style={{ paddingTop: before, paddingBottom: after }}>
      {items.map((vi) => {
        const i = vi.index
        const item = rows[i]
        if (!item) return null
        return (
          // O espaço entre os itens fica dentro de cada um (pb-3), para entrar na medida.
          <div key={vi.key} data-index={i} ref={virtualizer.measureElement} className={i < rows.length - 1 ? 'pb-3' : undefined}>
            {item.kind === 'step' ? (
              <Step dot={item.dot} dotTop={item.dotTop} connect={rows[i + 1]?.kind === 'step'} enter={i > lastInitial && !entered.current.has(item.key)}>
                {item.node}
              </Step>
            ) : (
              <div data-prompt={item.kind === 'user' ? item.key : undefined} className="timeline-item">
                {item.node}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
})
