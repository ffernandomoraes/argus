import { memo, useRef } from 'react'
import { Step } from './rows/Step'
import type { TimelineItem } from './timelineItem'

// A conversa desenhada: balões e divisores soltos, passos do Claude com a bolinha e a linha que
// desce até o próximo passo (mensagem sua interrompe a linha do tempo). data-prompt marca os
// balões para o prompt preso no topo (useStickyScroll).
// Passo novo entra com um fade subindo de leve; os que já estavam quando a conversa abriu (ou o
// histórico chegou de uma vez) aparecem parados, para não animar a conversa inteira.
export const Timeline = memo(function Timeline({ items }: { items: TimelineItem[] }) {
  const initial = useRef<Set<string> | null>(null)
  if (!initial.current && items.length) initial.current = new Set(items.map((item) => item.key))
  return (
    <>
      {items.map((item, i) =>
        item.kind === 'step' ? (
          <Step key={item.key} dot={item.dot} dotTop={item.dotTop} connect={items[i + 1]?.kind === 'step'} enter={!initial.current?.has(item.key)}>
            {item.node}
          </Step>
        ) : (
          <div key={item.key} data-prompt={item.kind === 'user' ? item.key : undefined} className="timeline-item">
            {item.node}
          </div>
        )
      )}
    </>
  )
})
