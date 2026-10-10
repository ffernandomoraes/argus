import { memo } from 'react'
import { Step } from './rows/Step'
import type { TimelineItem } from './timelineItem'

// A conversa desenhada: balões e divisores soltos, passos do Claude com a bolinha e a linha que
// desce até o próximo passo (mensagem sua interrompe a linha do tempo). data-prompt marca os
// balões para o prompt preso no topo (useStickyScroll).
export const Timeline = memo(function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <>
      {items.map((item, i) =>
        item.kind === 'step' ? (
          <Step key={item.key} dot={item.dot} dotTop={item.dotTop} connect={items[i + 1]?.kind === 'step'}>
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
