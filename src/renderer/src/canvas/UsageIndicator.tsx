import { memo, useEffect, useRef } from 'react'
import { agentRef, type ProviderId } from '../../../shared/providers'
import { barWindow, expiredUsage, usableUsage } from '../../../shared/usage'
import { useAuth } from '../auth/useAuth'
import { AgentIcon } from '../icons/AgentIcon'
import { useNow } from '../lib/clock'
import { Presence } from '../motion'
import { useProviders } from '../providers/useProviders'
import { useEscape } from '../useEscape'
import { useOutsideClick } from '../useOutsideClick'
import { UsageBar } from './bars/UsageBar'
import { UsagePanel, type ShownUsage } from './bars/UsagePanel'
import { useUsages } from './bars/useUsages'
import { tr } from '../i18n'

// Agentes sem limite legível por programa: aparecem só como aviso no painel (ver UsagePanel).
const SILENT: ProviderId[] = ['gemini', 'cursor']

// Limites no canto direito da barra de baixo; o painel abre para cima. O botão mostra a janela mais curta de cada
// conta (a sessão de 5 horas no Claude; o semanal na conta sem sessão, ver barWindow), com o logo antes das contas de cada agente e o nome quando
// o agente tem mais de uma; o painel traz todas as janelas de todas. As contas dos outros agentes
// (hoje, só o Codex informa limite) entram só com o experimento de vários agentes ligado.
// Só o que ainda vale (ver usableUsage): janela que já recomeçou não mostra o número antigo, e o
// relógio é o mesmo do painel. O uso guardado da abertura anterior aparece apagado até a leitura nova.
// O contêiner ocupa a altura da barra: o painel abre acima dela, não sobre a borda.
// O aberto fica com a BottomBar: enquanto o painel está à vista, ela sobe acima dos drawers.
export const UsageIndicator = memo(function UsageIndicator({
  open,
  onOpenChange
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const usages = useUsages()
  const now = useNow(30_000)
  const auth = useAuth()
  const providers = useProviders()
  // Botão e painel num elemento só: o clique no botão não conta como fora.
  const ref = useRef<HTMLDivElement>(null)
  useOutsideClick(ref, () => onOpenChange(false), open)
  useEscape(() => onOpenChange(false), open)
  // Painel aberto: quem abre quer o número de agora (o monitor só lê se a última leitura não for recente).
  useEffect(() => {
    if (open) window.api.usage.refresh()
  }, [open])

  // Na ordem das configurações: o Claude primeiro (a principal antes), depois as do Codex.
  // Conta desconectada sai da barra mesmo com uso na mão; sem status (não deu para conferir), fica.
  const candidates: Omit<ShownUsage, 'usage'>[] = [
    ...(auth?.accounts ?? []).filter((a) => a.status?.loggedIn !== false).map((a) => ({ key: a.id, name: a.name })),
    ...(providers?.providers.codex.accounts ?? []).filter((a) => a.status?.signedIn !== false).map((a) => ({
      key: agentRef('codex', a.id),
      provider: 'codex' as const,
      name: a.name
    }))
  ]
  const shown = candidates.flatMap((c): ShownUsage[] => {
    const usage = usages[c.key] && usableUsage(usages[c.key], now)
    // Sem atualizar há mais de uma hora, fica sem números, com o aviso no painel.
    return usage && (barWindow(usage) || expiredUsage(usage, now)) ? [{ ...c, usage }] : []
  })
  const silent = SILENT.filter((p) => providers?.providers[p].accounts.some((a) => a.status?.signedIn))
  if (!shown.length) return null
  const mixed = shown.some((x) => x.provider)
  // Contas por agente: o nome só aparece quando o mesmo agente tem mais de uma (o logo já diz qual é).
  const perAgent = (provider?: ProviderId) => shown.filter((x) => x.provider === provider).length
  const saved = shown.some((x) => x.usage.saved)
  const stale = shown.some((x) => x.usage.failure || !barWindow(x.usage))
  // Barra mais larga com uma conta só; encolhe conforme entram outras, para o botão não crescer demais.
  const barWidth = shown.length === 1 ? 'w-20' : shown.length === 2 ? 'w-14' : 'w-10'

  return (
    <div ref={ref} className="relative flex items-center self-stretch">
      <button
        aria-label={mixed ? tr('Ver limites de uso', 'View usage limits') : tr('Ver limites do Claude', 'View Claude limits')}
        aria-expanded={open}
        title={
          stale
            ? tr('O uso não atualizou, veja o motivo nos limites', 'Usage didn’t update, see why in the limits')
            : saved
              ? tr('Último uso guardado, conferindo de novo', 'Last saved usage, checking again')
              : undefined
        }
        onClick={() => onOpenChange(!open)}
        className={`flex items-center gap-2 rounded-md px-2 py-0.5 text-[12px] text-faint hover:bg-fill hover:text-muted ${
          open ? 'bg-fill text-muted' : ''
        }`}
      >
        {shown.map(({ key, provider, name, usage }, i) => {
          // Sem janela: sem atualizar há mais de uma hora (ver acima).
          const limit = barWindow(usage)
          const percent = limit ? Math.round(limit.percent) : null
          const firstOfAgent = i === 0 || shown[i - 1].provider !== provider
          const dimmed = usage.saved || usage.failure
          return (
            <span
              key={key}
              // A conta sem sessão mostra o semanal: a dica diz de qual janela é o número.
              title={usage.noSession && limit && !dimmed ? tr('Semanal - sem limite de 5 horas', 'Weekly - no 5-hour limit') : undefined}
              className={`flex items-center gap-2 ${dimmed ? 'opacity-50' : ''}`}
            >
              {i > 0 && <span>-</span>}
              {firstOfAgent && <AgentIcon provider={provider} size={12} />}
              {perAgent(provider) > 1 && <span className="max-w-24 truncate">{name}</span>}
              <UsageBar percent={percent ?? 0} className={`h-1 ${barWidth}`} />
              <span className="font-mono text-muted">{percent === null ? '--' : `${percent}%`}</span>
            </span>
          )
        })}
      </button>
      <Presence kind="menu">{open && <UsagePanel shown={shown} silent={silent} />}</Presence>
    </div>
  )
})
