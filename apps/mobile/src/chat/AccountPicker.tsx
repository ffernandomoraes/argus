import { useState, type ReactNode } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { followMerged, type AuthState } from '@argus/shared/auth'
import { agentRef, parseAgentRef, PROVIDER_NAMES, PROVIDERS, type ProviderId, type ProvidersState } from '@argus/shared/providers'
import { AgentIcon } from '@argus/ui/icons/AgentIcon'
import { tr } from '../i18n'
import { useAuthState, useProvidersState } from '../lib/data'
import { Sheet } from '../ui/Sheet'

// A conta (e o agente) da conversa, na barra do topo, como o selo do cabeçalho da conversa no Argus.
// Conversa nova: qualquer agente e conta conectados. Conversa do Claude já começada: só as contas
// do Claude (o Argus reabre a sessão na outra conta, retomando a mesma conversa). Conversa de outro
// agente já começada: só mostra.

type Option = { id: string; name: string; provider?: ProviderId }
type Group = { label: string; provider?: ProviderId; options: Option[] }

function groupsFor(auth: AuthState | undefined, providers: ProvidersState | undefined, claudeOnly: boolean): Group[] {
  const groups: Group[] = [
    { label: 'Claude', options: (auth?.accounts ?? []).filter((a) => a.status?.loggedIn !== false).map((a) => ({ id: a.id, name: a.name })) }
  ]
  if (!claudeOnly)
    for (const provider of PROVIDERS) {
      const accounts = (providers?.providers[provider]?.accounts ?? []).filter((a) => a.status?.signedIn !== false)
      groups.push({ label: PROVIDER_NAMES[provider], provider, options: accounts.map((a) => ({ id: agentRef(provider, a.id), name: a.name, provider })) })
    }
  return groups.filter((g) => g.options.length)
}

// A conta que vale: a pedida ou, sem ela, a padrão (do Claude, ou do agente).
export function resolveAccount(account: string | undefined, auth: AuthState | undefined, providers: ProvidersState | undefined): Option | null {
  const agent = parseAgentRef(account)
  if (agent) {
    const p = providers?.providers[agent.provider]
    const chosen = p?.accounts.find((a) => a.id === agent.account) ?? p?.accounts.find((a) => a.id === p.defaultId)
    return { id: chosen ? agentRef(agent.provider, chosen.id) : account!, name: chosen?.name ?? PROVIDER_NAMES[agent.provider], provider: agent.provider }
  }
  if (!auth) return null
  // Conta que saiu da lista por ter o mesmo login de outra: vale a que ficou no lugar dela.
  const wanted = account && followMerged(auth.mergedInto, account)
  const chosen =
    auth.accounts.find((a) => a.id === account) ??
    auth.accounts.find((a) => a.id === wanted) ??
    auth.accounts.find((a) => a.id === auth.defaultId) ??
    auth.accounts[0]
  return chosen ? { id: chosen.id, name: chosen.name } : null
}

export function AccountPicker({
  account,
  started,
  tint,
  circle,
  onChange
}: {
  account: string | undefined
  started: boolean
  tint?: boolean
  // Botão redondo só com o logo do agente (a conversa no estilo flutuante).
  circle?: boolean
  onChange: (account: string) => void
}) {
  const auth = useAuthState()
  const providers = useProvidersState()
  const [open, setOpen] = useState(false)
  const current = resolveAccount(account, auth, providers)
  if (!current) return null
  const agentChat = !!current.provider
  const locked = started && agentChat
  const groups = locked ? [] : groupsFor(auth, providers, started)
  const total = groups.reduce((n, g) => n + g.options.length, 0)
  const canChange = !locked && total > 1
  // Compacto: o logo e o primeiro nome (o nome inteiro fica na gaveta); outro agente, o nome dele.
  const label = current.provider ? PROVIDER_NAMES[current.provider] : current.name.split(/\s+/)[0]
  const chip: ReactNode = (
    <>
      <AgentIcon provider={current.provider} size={14} />
      <span className="max-w-[72px] truncate text-[13px] font-medium">{label}</span>
      {canChange && <ChevronDown size={12} className="shrink-0 opacity-60" />}
    </>
  )
  const chipClass = circle
    ? 'flex size-12 items-center justify-center rounded-full border border-line bg-card shadow-[0_4px_16px_rgba(0,0,0,0.08)]'
    : `flex items-center gap-1 rounded-full py-1 pr-2 pl-1.5 ${tint ? 'bg-white/15 text-white' : 'bg-code text-text'}`
  const content: ReactNode = circle ? <AgentIcon provider={current.provider} size={22} /> : chip
  if (!canChange) return <span className={chipClass}>{content}</span>
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`${chipClass} active:opacity-60`} aria-label={tr(`Conta desta conversa: ${current.name}`, `Account for this chat: ${current.name}`)}>
        {content}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={started ? tr('Conta do Claude', 'Claude account') : tr('Agente e conta', 'Agent and account')}>
        {started && (
          <p className="mb-3 text-center text-[13px] leading-snug text-muted">
            {tr('A conversa continua de onde parou, na conta escolhida.', 'The chat continues where it left off, on the chosen account.')}
          </p>
        )}
        {groups.map((g) => (
          <section key={g.label} className="mt-4 first:mt-0">
            <h3 className="mb-1.5 flex items-center gap-1.5 px-4 text-[13px] tracking-wide text-muted uppercase">
              <AgentIcon provider={g.provider} size={14} />
              {g.label}
            </h3>
            <div className="overflow-hidden rounded-[12px] border border-card-border bg-card">
              {g.options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    onChange(o.id)
                    setOpen(false)
                  }}
                  className="flex w-full items-center gap-3 border-b border-line px-4 py-[13px] text-left last:border-0 active:bg-card-press"
                >
                  <span className="min-w-0 flex-1 truncate text-[17px]">{o.name}</span>
                  {o.id === current.id && <Check size={18} className="shrink-0 text-accent" />}
                </button>
              ))}
            </div>
          </section>
        ))}
      </Sheet>
    </>
  )
}
