import { useState, type ReactNode } from 'react'

// <details> que só monta o corpo depois de aberto pela primeira vez (e o mantém depois). Fechado,
// o corpo não é desenhado: o relatório de um subagente (até 20 mil caracteres de markdown) custava
// ~18 ms por linha recolhida ao abrir a conversa. `open`: nasce aberto (e abre quando passa a true).
export function LazyDetails({
  open = false,
  className,
  summary,
  children
}: {
  open?: boolean
  className?: string
  summary: ReactNode
  children: ReactNode
}) {
  const [opened, setOpened] = useState(open)
  return (
    <details className={className} open={open} onToggle={(e) => e.currentTarget.open && setOpened(true)}>
      {summary}
      {(opened || open) && children}
    </details>
  )
}
