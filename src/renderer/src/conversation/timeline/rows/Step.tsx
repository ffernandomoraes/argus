import type { ReactNode } from 'react'

// Um passo da linha do tempo: bolinha à esquerda e linha até o próximo passo. `enter`: passo que
// acabou de chegar, entra com animação (step-in).
export function Step({
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
  return (
    <div className={`relative pl-5 ${enter ? 'step-in' : ''}`}>
      {connect && <span className="absolute left-[5px] w-px bg-line" style={{ top: dotTop + 10, bottom: -18 }} />}
      <span className={`absolute left-[2px] size-[7px] rounded-full ${dot}`} style={{ top: dotTop }} />
      <div className="timeline-item">{children}</div>
    </div>
  )
}
