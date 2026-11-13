import type { ReactNode } from 'react'
import { Tooltip, type TooltipSide } from './Tooltip'

// Botão das barras do canvas (lateral, zoom, título), com a dica ao passar o mouse. `selected`
// marca um botão ligado sem esconder a dica.
export function NavButton({
  label,
  shortcut,
  onClick,
  active,
  selected,
  primary,
  compact,
  side = 'right',
  children
}: {
  label: string
  shortcut?: string
  onClick: () => void
  active?: boolean
  selected?: boolean
  primary?: boolean
  // Versão menor, para barras discretas (ViewBar). A largura cresce com o conteúdo, como o "88%".
  compact?: boolean
  side?: TooltipSide
  children: ReactNode
}) {
  // O principal (Novo bloco) na cor de destaque, como o botão padrão do macOS.
  const tone = primary
    ? 'bg-accent text-white hover:brightness-110'
    : active || selected
      ? 'bg-fill text-text ring-1 ring-line ring-inset'
      : 'text-muted hover:bg-fill hover:text-text'

  return (
    <button
      aria-label={label}
      onClick={onClick}
      className={`group relative flex items-center justify-center ${compact ? 'h-6 min-w-6 rounded-md' : 'size-8 rounded-md'} ${tone}`}
    >
      {children}
      {!active && <Tooltip label={label} shortcut={shortcut} side={side} />}
    </button>
  )
}
