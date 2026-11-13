import { keys } from '../platform'

const TOOLTIP_SIDE = {
  top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
  // Alinhado à direita do botão, para não sair da janela no canto direito.
  'top-end': 'bottom-full right-0 mb-2',
  right: 'left-full top-1/2 ml-2 -translate-y-1/2',
  // Na barra de título: abre para baixo, alinhado à direita do botão.
  'bottom-end': 'top-full right-0 mt-2'
}

export type TooltipSide = keyof typeof TOOLTIP_SIDE

// Dica que aparece ao passar o mouse: vai dentro de um elemento `group relative` (o botão).
// Usada na barra lateral (abre à direita), na barra de zoom e nos botões que flutuam acima da pasta.
export function Tooltip({ label, shortcut, side = 'top' }: { label: string; shortcut?: string; side?: TooltipSide }) {
  return (
    <span
      className={`pointer-events-none absolute hidden items-center gap-2 whitespace-nowrap rounded-lg border border-line bg-surface/90 px-2 py-1 text-[12px] text-text shadow-lg backdrop-blur-xl group-hover:flex ${TOOLTIP_SIDE[side]}`}
    >
      {label}
      {/* Escrito como no Mac ("⌘ ,"); no Windows aparece "Ctrl+,". */}
      {shortcut && <kbd className="font-mono text-faint">{keys(shortcut)}</kbd>}
    </span>
  )
}
