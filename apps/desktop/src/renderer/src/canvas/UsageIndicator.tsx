import { memo, useEffect, useRef, useState } from 'react'
import { lostLogin } from '@argus/shared/auth'
import { agentRef, type ProviderId } from '@argus/shared/providers'
import { barWindow, expiredUsage, showsUsage, usableUsage } from '@argus/shared/usage'
import { wslUsage, wslUsageKey } from '@argus/shared/wslUsage'
import { loginEndWarning } from '../auth/loginEnd'
import { LoginModal, startRelogin, type ReloginTarget } from '../auth/LoginModal'
import { useAuth } from '../auth/useAuth'
import { AgentIcon } from '@argus/ui/icons/AgentIcon'
import { useNow } from '../lib/clock'
import { Presence } from '../motion'
import { useProviders } from '../providers/useProviders'
import { useEscape } from '../useEscape'
import { useOutsideClick } from '../useOutsideClick'
import { UsageBar } from './bars/UsageBar'
import { UsagePanel, type LoginEnding, type ShownUsage, type SignedOutLogin } from './bars/UsagePanel'
import { useUsages } from './bars/useUsages'
import { tr } from '../i18n'

// Agentes sem limite legível por programa: aparecem só como aviso no painel (ver UsagePanel).
const SILENT: ProviderId[] = ['gemini', 'cursor']

// Limites no canto direito da barra de baixo; o painel abre para cima. O botão mostra a janela mais curta de cada
// conta (a sessão de 5 horas no Claude; o semanal na conta sem sessão, ver barWindow), com o logo antes das contas de cada agente e o nome quando
// o agente tem mais de uma; o painel traz todas as janelas de todas. As contas dos outros agentes
// (hoje, só o Codex informa limite) entram só com o experimento de vários agentes ligado.
// Só o que ainda vale (ver usableUsage): janela que já recomeçou não mostra o número antigo (a conta
// fica com "--" até a leitura nova, sem sumir; ver showsUsage), e o relógio é o mesmo do painel. O
// uso guardado da abertura anterior aparece apagado até a leitura nova.
// No Windows com o claude.exe, o login de uma conta dentro do WSL que é de outra conta do Claude tem
// a linha dele, logo depois da conta ("Nome - WSL"; ver shared/wslUsage.ts).
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
  // Login começado pelo painel (conta sem login ou perto do prazo): o aviso fica aqui, e não no
  // painel, que fecha ao abrir o navegador.
  const [relogin, setRelogin] = useState<ReloginTarget | null>(null)
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
  const accounts = auth?.accounts ?? []
  const wsl = wslUsage(accounts)
  const nameOf = (id: string) => accounts.find((a) => a.id === id)?.name ?? ''
  const candidates: Omit<ShownUsage, 'usage'>[] = [
    ...accounts.flatMap((a) => {
      const lent = wsl.borrowed.find((b) => b.account === a.id)
      const note = lent
        ? tr(
            `No WSL, esta conta está com o login de ${nameOf(lent.from)}: o uso de lá aparece em ${nameOf(lent.from)}.`,
            `In WSL, this account is signed in as ${nameOf(lent.from)}: usage from there shows under ${nameOf(lent.from)}.`
          )
        : undefined
      // Login perto do prazo final: o aviso vai junto da conta, com o botão de entrar de novo. O de uma
      // distro com login próprio vai na linha dela ou, quando ela não tem linha (o login de lá é o desta
      // mesma conta), aqui.
      const ending = (status: typeof a.status, distro?: string): LoginEnding[] => {
        const text = loginEndWarning(status, now, distro && `WSL (${distro})`)
        return text ? [{ text, account: a.id, ...(distro && { distro }) }] : []
      }
      const placeOf = (distro: string) => ((a.wsl?.length ?? 0) > 1 ? `WSL (${distro})` : 'WSL')
      // Com mais de uma distro, o nome diz qual.
      const there = wsl.logins
        .filter((l) => l.account === a.id)
        .map((l) => ({ key: l.key, name: a.name, place: placeOf(l.distro), endings: ending(a.wsl?.find((w) => w.distro === l.distro)?.status ?? null, l.distro) }))
      const unlisted = (a.wsl ?? []).filter((w) => !there.some((t) => t.key === wslUsageKey(w.distro, a.id))).flatMap((w) => ending(w.status, w.distro))
      const own = a.status?.loggedIn !== false ? [{ key: a.id, name: a.name, note, endings: [...ending(a.status), ...unlisted] }] : []
      return [...own, ...there]
    }),
    ...(providers?.providers.codex.accounts ?? []).filter((a) => a.status?.signedIn !== false).map((a) => ({
      key: agentRef('codex', a.id),
      provider: 'codex' as const,
      name: a.name
    }))
  ]
  const shown = candidates.flatMap((c): ShownUsage[] => {
    const usage = usages[c.key] && usableUsage(usages[c.key], now)
    // Sem atualizar há mais de uma hora, ou com a janela recém-recomeçada, fica sem números, com o
    // motivo no painel.
    return usage && showsUsage(usage) ? [{ ...c, usage }] : []
  })
  const silent = SILENT.filter((p) => providers?.providers[p].accounts.some((a) => a.status?.signedIn))
  // Contas do Claude que perderam o login (ver lostLogin): ficam na barra, em destaque, com o botão
  // de entrar no painel, em vez de sumir junto com os números.
  const signedOut: SignedOutLogin[] = accounts.filter(lostLogin).map((a) => ({ key: `lost:${a.id}`, name: a.name, account: a.id }))
  if (!shown.length && !signedOut.length) return (
    <LoginModal target={relogin} onClose={() => setRelogin(null)} />
  )
  const mixed = shown.some((x) => x.provider)
  // Contas por agente: o nome só aparece quando o mesmo agente tem mais de uma (o logo já diz qual é).
  const perAgent = (provider?: ProviderId) => shown.filter((x) => x.provider === provider).length
  const saved = shown.some((x) => x.usage.saved)
  const stale = shown.some((x) => x.usage.failure || expiredUsage(x.usage, now))
  // Sem número e sem falha: a janela recomeçou e a leitura nova ainda não chegou.
  const waiting = shown.some((x) => !barWindow(x.usage))
  // Login de alguma conta perto do prazo final: bolinha no botão, e o aviso no painel.
  const warned = shown.some((x) => x.endings?.length)
  // Barra mais larga com uma conta só; encolhe conforme entram outras, para o botão não crescer demais.
  const barWidth = shown.length === 1 ? 'w-20' : shown.length === 2 ? 'w-14' : 'w-10'
  // Com mais de uma conta à vista, a sem login leva o nome.
  const signedOutNamed = shown.length + signedOut.length > 1

  return (
    <div ref={ref} className="relative flex items-center self-stretch">
      <button
        aria-label={mixed ? tr('Ver limites de uso', 'View usage limits') : tr('Ver limites do Claude', 'View Claude limits')}
        aria-expanded={open}
        title={
          signedOut.length
            ? tr('Uma conta está sem login, entre de novo pelos limites', 'An account is signed out, sign in again from the limits')
            : warned
            ? tr('O login de uma conta está perto do fim, veja nos limites', 'An account’s sign-in is about to end, see the limits')
            : stale
            ? tr('O uso não atualizou, veja o motivo nos limites', 'Usage didn’t update, see why in the limits')
            : saved
              ? tr('Último uso guardado, conferindo de novo', 'Last saved usage, checking again')
              : waiting
                ? tr('A janela recomeçou, aguardando a próxima leitura', 'The window restarted, waiting for the next reading')
                : undefined
        }
        onClick={() => onOpenChange(!open)}
        className={`flex items-center gap-2 rounded-md px-2 py-0.5 text-[12px] text-faint hover:bg-fill hover:text-muted ${
          open ? 'bg-fill text-muted' : ''
        }`}
      >
        {shown.map(({ key, provider, name, place, usage }, i) => {
          // Sem janela: sem atualizar há mais de uma hora, ou recém-recomeçada (ver acima).
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
              {/* O lugar fica fora do corte do nome: "Nome compri… - WSL". */}
              {(perAgent(provider) > 1 || place) && (
                <span className="flex items-center gap-1">
                  <span className="max-w-24 truncate">{name}</span>
                  {place && <span className="whitespace-nowrap">- {place}</span>}
                </span>
              )}
              <UsageBar percent={percent ?? 0} className={`h-1 ${barWidth}`} />
              <span className="font-mono text-muted">{percent === null ? '--' : `${percent}%`}</span>
            </span>
          )
        })}
        {signedOut.map(({ key, name }, i) => (
          <span key={key} className="flex items-center gap-2 text-needs-you">
            {(shown.length > 0 || i > 0) && <span className="text-faint">-</span>}
            {shown.length === 0 && i === 0 && <AgentIcon size={12} />}
            {signedOutNamed && <span className="max-w-24 truncate">{name}</span>}
            <span className="whitespace-nowrap">{tr('sem login', 'signed out')}</span>
          </span>
        ))}
        {warned && !signedOut.length && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-needs-you" />}
      </button>
      <Presence kind="menu">
        {open && (
          <UsagePanel
            shown={shown}
            silent={silent}
            signedOut={signedOut}
            onLogin={(accountId, distro) => {
              const account = accounts.find((a) => a.id === accountId)
              if (!account) return
              setRelogin(startRelogin(auth, account, distro))
              onOpenChange(false)
            }}
          />
        )}
      </Presence>
      <LoginModal target={relogin} onClose={() => setRelogin(null)} />
    </div>
  )
})
