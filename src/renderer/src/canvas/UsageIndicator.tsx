import { memo, useRef } from 'react'
import { agentRef, type ProviderId } from '../../../shared/providers'
import { useAuth } from '../auth/useAuth'
import { AgentIcon } from '../icons/AgentIcon'
import { Presence } from '../motion'
import { useProviders } from '../providers/useProviders'
import { usePreference } from '../settings/preferences'
import { useEscape } from '../useEscape'
import { useOutsideClick } from '../useOutsideClick'
import { UsageBar } from './bars/UsageBar'
import { UsagePanel, type ShownUsage } from './bars/UsagePanel'
import { useUsages } from './bars/useUsages'
import { tr } from '../i18n'

// Agentes sem limite legível por programa: aparecem só como aviso no painel (ver UsagePanel).
const SILENT: ProviderId[] = ['gemini', 'cursor']

// Limites na barra de título; o painel abre para baixo. O botão mostra a janela mais curta de cada
// conta (a sessão de 5 horas no Claude), com o logo antes das contas de cada agente e o nome quando
// o agente tem mais de uma; o painel traz todas as janelas de todas. As contas dos outros agentes
// (hoje, só o Codex informa limite) entram só com o experimento de vários agentes ligado.
// O contêiner ocupa a altura da barra: o painel abre abaixo dela, não sobre a borda.
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
  const providers = useProviders()
  const multiAgents = usePreference('multiAgents')
  // Botão e painel num elemento só: o clique no botão não conta como fora.
  const ref = useRef<HTMLDivElement>(null)
  useOutsideClick(ref, () => onOpenChange(false), open)
  useEscape(() => onOpenChange(false), open)

  // Na ordem das configurações: o Claude primeiro (a principal antes), depois as do Codex.
  const candidates: Omit<ShownUsage, 'usage'>[] = [
    ...(auth?.accounts ?? []).map((a) => ({ key: a.id, name: a.name })),
    ...(multiAgents ? (providers?.providers.codex.accounts ?? []) : []).map((a) => ({
      key: agentRef('codex', a.id),
      provider: 'codex' as const,
      name: a.name
    }))
  ]
  const shown = candidates.flatMap((c): ShownUsage[] => (usages[c.key]?.session ? [{ ...c, usage: usages[c.key] }] : []))
  const silent = multiAgents ? SILENT.filter((p) => providers?.providers[p].accounts.some((a) => a.status?.signedIn)) : []
  if (!shown.length) return null
  const mixed = shown.some((x) => x.provider)
  // Contas por agente: o nome só aparece quando o mesmo agente tem mais de uma (o logo já diz qual é).
  const perAgent = (provider?: ProviderId) => shown.filter((x) => x.provider === provider).length

  return (
    <div ref={ref} className="no-drag relative flex items-center self-stretch">
      <button
        aria-label={mixed ? tr('Ver limites de uso', 'View usage limits') : tr('Ver limites do Claude', 'View Claude limits')}
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className={`flex items-center gap-2 rounded-md px-2 py-0.5 text-[12px] text-faint hover:bg-fill hover:text-muted ${
          open ? 'bg-fill text-muted' : ''
        }`}
      >
        {shown.map(({ key, provider, name, usage }, i) => {
          const percent = Math.round(usage.session!.percent)
          const firstOfAgent = i === 0 || shown[i - 1].provider !== provider
          return (
            <span key={key} className="flex items-center gap-2">
              {i > 0 && <span>-</span>}
              {firstOfAgent && <AgentIcon provider={provider} size={12} />}
              {perAgent(provider) > 1 && <span className="max-w-24 truncate">{name}</span>}
              <UsageBar percent={percent} className="h-1 w-10" />
              <span className="font-mono text-muted">{percent}%</span>
            </span>
          )
        })}
      </button>
      <Presence kind="menu">{open && <UsagePanel shown={shown} silent={silent} />}</Presence>
    </div>
  )
})
