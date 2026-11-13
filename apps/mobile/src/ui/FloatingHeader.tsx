import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { tr } from '../i18n'

// Topo flutuante (o da conversa): voltar num botão redondo à esquerda, o título pequeno no meio,
// uma ação à direita, e o conteúdo sumindo suave embaixo deles. A tela dá o espaço de cima com
// FLOATING_HEADER_SPACE.

export const FLOATING_HEADER_SPACE = 'pt-[calc(env(safe-area-inset-top)+76px)]'

// Botão redondo do topo (o de voltar, o do agente).
export const ROUND_BUTTON = 'flex size-12 shrink-0 items-center justify-center rounded-full border border-line bg-card shadow-[0_4px_16px_rgba(0,0,0,0.08)] active:opacity-60'

export function FloatingHeader({
  title,
  subtitle,
  onBack,
  backLabel,
  right
}: {
  title?: ReactNode
  subtitle?: ReactNode
  onBack: () => void
  backLabel?: string
  right?: ReactNode
}) {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-20">
      <div className="pt-safe bg-gradient-to-b from-bg via-bg/95 to-transparent">
        <div className="px-safe flex items-center gap-3 pt-2 pb-6">
          <button
            type="button"
            onClick={onBack}
            aria-label={backLabel ? tr(`Voltar para ${backLabel}`, `Back to ${backLabel}`) : tr('Voltar', 'Back')}
            className={`pointer-events-auto ${ROUND_BUTTON}`}
          >
            <ChevronLeft size={26} strokeWidth={2} />
          </button>
          <div className="min-w-0 flex-1 text-center leading-tight">
            {title && <div className="truncate text-[15px] font-semibold">{title}</div>}
            {subtitle && <div className="truncate text-[12px] text-muted">{subtitle}</div>}
          </div>
          {/* Sem ação à direita, um espaço do tamanho do botão: o título fica no meio. */}
          <div className="pointer-events-auto flex min-w-12 shrink-0 justify-end">{right}</div>
        </div>
      </div>
    </header>
  )
}
