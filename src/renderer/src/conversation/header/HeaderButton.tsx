import type { ReactNode } from 'react'
import { IconButton } from '../../ui/IconButton'

// Botão de ícone dos cabeçalhos (conversa, bloco no canvas, design): o IconButton da base, com
// `active` como estado ligado.
export function HeaderButton({
  label,
  onClick,
  active,
  children
}: {
  label: string
  onClick: () => void
  active?: boolean
  children: ReactNode
}) {
  return (
    <IconButton label={label} onClick={onClick} pressed={active}>
      {children}
    </IconButton>
  )
}
