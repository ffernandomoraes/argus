import { useRef, useState, type ReactNode } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import type { AuthState } from '../../../../shared/auth'
import { agentRef, parseAgentRef, PROVIDER_NAMES, PROVIDERS, type ProvidersState } from '../../../../shared/providers'
import { resolveAccount, useAuth } from '../../auth/useAuth'
import { AgentIcon } from '../../icons/AgentIcon'
import { ClaudeIcon } from '../../icons/ClaudeIcon'
import { Presence } from '../../motion'
import { useProviders } from '../../providers/useProviders'
import { usePreference } from '../../settings/preferences'
import { MenuArrow } from '../../ui/MenuArrow'
import { MENU_HOVER } from '../../ui/menuStyles'
import { useEscape } from '../../useEscape'
import { useOutsideClick } from '../../useOutsideClick'
import { POPOVER } from '../popover'
import { tr } from '../../i18n'

type Option = { id: string; name: string; signedOut: boolean }
type Section = { label: string; icon: ReactNode; options: Option[] }

// Contas que dá para escolher, por agente: as do Claude e, com o experimento dos outros agentes
// ligado, as de cada agente com conta conectada (como o menu "Agente" do grupo).
function sectionsFor(auth: AuthState | null, providers: ProvidersState | null, multiAgents: boolean): Section[] {
  const sections: Section[] = [
    {
      label: 'Claude',
      icon: <ClaudeIcon size={12} />,
      options: (auth?.accounts ?? []).map((a) => ({ id: a.id, name: a.name, signedOut: a.status?.loggedIn === false }))
    }
  ]
  if (!multiAgents) return sections
  for (const provider of PROVIDERS) {
    const accounts = providers?.providers[provider]?.accounts ?? []
    if (!accounts.length) continue
    sections.push({
      label: PROVIDER_NAMES[provider],
      icon: <AgentIcon provider={provider} size={12} />,
      options: accounts.map((a) => ({ id: agentRef(provider, a.id), name: a.name, signedOut: a.status?.signedIn === false }))
    })
  }
  return sections.filter((s) => s.options.length)
}

// Logo do agente que roda a conversa, antes do título; o nome da conta fica no tooltip. Com
// `onChange` (conversa vazia) vira botão que abre o seletor; depois do primeiro envio só mostra. Com uma conta só do Claude e
// sem outros agentes, como a etiqueta do grupo, não há o que mostrar.
export function AccountTag({ account, onChange }: { account?: string; onChange?: (account: string) => void }) {
  const auth = useAuth()
  const providers = useProviders()
  const multiAgents = usePreference('multiAgents')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutsideClick(ref, () => setOpen(false), open)
  useEscape(() => setOpen(false), open)

  const sections = sectionsFor(auth, providers, multiAgents)
  const total = sections.reduce((n, s) => n + s.options.length, 0)

  // O que vale agora: a conta pedida ou, sem ela (ou removida), a padrão do agente.
  const agent = parseAgentRef(account)
  let currentId: string
  let icon: ReactNode
  let name: string
  if (agent) {
    const { accounts, defaultId } = providers?.providers[agent.provider] ?? { accounts: [], defaultId: null }
    const chosen = accounts.find((a) => a.id === agent.account) ?? accounts.find((a) => a.id === defaultId)
    currentId = chosen ? agentRef(agent.provider, chosen.id) : account!
    icon = <AgentIcon provider={agent.provider} size={14} />
    name = `${PROVIDER_NAMES[agent.provider]}${chosen && accounts.length > 1 ? ` - ${chosen.name}` : ''}`
  } else {
    if (!auth || (auth.accounts.length < 2 && !multiAgents)) return null
    currentId = resolveAccount(auth, account)
    const chosen = auth.accounts.find((a) => a.id === currentId)
    if (!chosen) return null
    icon = <ClaudeIcon size={14} />
    name = chosen.name
  }

  const title = tr(`Conta desta conversa: ${name}`, `Account for this chat: ${name}`)

  if (!onChange || total < 2)
    return (
      <span title={`${title}. ${tr('Só dá para trocar antes do primeiro envio.', 'It can only be changed before the first message.')}`} className="flex size-6 shrink-0 items-center justify-center">
        {icon}
      </span>
    )

  return (
    // Clicar no logo não arrasta a janela (no-drag), o bloco no canvas (nodrag) nem o painel
    // (o pointerdown não sobe para o cabeçalho).
    <div ref={ref} onPointerDown={(e) => e.stopPropagation()} className="no-drag nodrag relative flex shrink-0">
      <button
        aria-expanded={open}
        aria-label={title}
        onClick={() => setOpen((o) => !o)}
        title={title}
        // A setinha mostra que dá para escolher; some depois do primeiro envio, junto com o seletor.
        className={`flex h-6 items-center gap-0.5 rounded-md px-1 ${open ? 'bg-surface-2 text-text' : 'text-faint hover:bg-surface-2 hover:text-text'}`}
      >
        {icon}
        <ChevronDown size={12} className="shrink-0" />
      </button>

      <Presence kind="menu">
        {open && (
          <div className={`absolute left-0 top-full z-50 mt-2.5 max-h-96 w-64 cursor-default overflow-y-auto ${POPOVER}`}>
            <MenuArrow side="top" />
            {sections.map((s) => (
              <div key={s.label}>
                <div className="flex items-center gap-1.5 px-2 pb-1 pt-1.5 text-[12px] text-faint">
                  {s.icon}
                  {s.label}
                </div>
                {s.options.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => {
                      onChange(o.id)
                      setOpen(false)
                    }}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs ${MENU_HOVER}`}
                  >
                    <span className="min-w-0 flex-1 truncate text-text">
                      {o.name}
                      {o.signedOut && <span className="text-faint">{tr(' - sem login', ' - not signed in')}</span>}
                    </span>
                    {o.id === currentId && <Check size={13} className="shrink-0 text-muted" />}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </Presence>
    </div>
  )
}
