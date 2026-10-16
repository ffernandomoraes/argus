import { memo, useState, type ReactNode } from 'react'

// Um passo da linha do tempo: bolinha à esquerda e linha até o próximo passo. `enter`: passo que
// acabou de chegar, entra com animação (step-in). Vale o da montagem: logo depois o Timeline já o
// conta como chegado, e tirar a classe no meio cortaria a animação. Com memo: o texto chegando
// refaz a lista, mas o conteúdo dos passos do histórico é o mesmo (useTimeline).
export const Step = memo(function Step({
  dot,
  dotTop = 8,
  connect,
  enter,
  children
}: {
  dot: string
  dotTop?: number
  connect: boolean
  enter?: boolean
  children: ReactNode
}) {
  const [entering] = useState(enter)
  return (
    <div className={`relative pl-5 ${entering ? 'step-in' : ''}`}>
      {connect && <span className="absolute left-[5px] w-px bg-line" style={{ top: dotTop + 10, bottom: -18 }} />}
      <span className={`absolute left-[2px] size-[7px] rounded-full ${dot}`} style={{ top: dotTop }} />
      <div className="timeline-item">{children}</div>
    </div>
  )
})
