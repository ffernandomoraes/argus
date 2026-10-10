import { memo, useRef } from 'react'
import type { ClaudeAccount } from '../../../shared/auth'
import type { Usage } from '../../../shared/usage'
import { useAuth } from '../auth/useAuth'
import { ClaudeIcon } from '../icons/ClaudeIcon'
import { Presence } from '../motion'
import { useEscape } from '../useEscape'
import { useOutsideClick } from '../useOutsideClick'
import { UsageBar } from './bars/UsageBar'
import { UsagePanel } from './bars/UsagePanel'
import { useUsages } from './bars/useUsages'

// Limites do Claude na barra de título; o painel abre para baixo. Com mais de uma conta, o botão
// mostra a sessão de cada uma, com o nome, e o painel traz sessão e semanal de todas.
// O aberto fica com a TitleBar: enquanto o painel está à vista, ela sobe acima dos drawers.
export const UsageIndicator = memo(function UsageIndicator({
  open,
  onOpenChange
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const usages = useUsages()
  const auth = useAuth()
  // Botão e painel num elemento só: o clique no botão não conta como fora.
  const ref = useRef<HTMLDivElement>(null)
  useOutsideClick(ref, () => onOpenChange(false), open)
  useEscape(() => onOpenChange(false), open)

  // Na ordem das configurações: a principal primeiro.
  const shown = (auth?.accounts ?? [])
    .map((account) => ({ account, usage: usages[account.id] }))
    .filter((x): x is { account: ClaudeAccount; usage: Usage } => !!x.usage?.session)
  if (!shown.length) return null
  const named = shown.length > 1

  return (
    <div ref={ref} className="no-drag relative">
      <button
        aria-label="Ver limites do Claude"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className={`flex items-center gap-2 rounded-md px-2 py-0.5 text-[12px] text-faint hover:bg-fill hover:text-muted ${
          open ? 'bg-fill text-muted' : ''
        }`}
      >
        <ClaudeIcon size={12} />
        {shown.map(({ account, usage }, i) => {
          const percent = Math.round(usage.session!.percent)
          return (
            <span key={account.id} className="flex items-center gap-2">
              {i > 0 && <span>-</span>}
              {named && <span className="max-w-24 truncate">{account.name}</span>}
              <UsageBar percent={percent} className="h-1 w-10" />
              <span className="font-mono text-muted">{percent}%</span>
            </span>
          )
        })}
      </button>
      <Presence kind="menu">{open && <UsagePanel shown={shown} />}</Presence>
    </div>
  )
})
