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
import { TAG } from './BranchTag'
import { tr } from '../../i18n'

type Option = { id: string; name: string; signedOut: boolean }
type Section = { label: string; icon: ReactNode; options: Option[] }

// Contas que dá para escolher, por agente: as do Claude e, com o experimento dos outros agentes
// ligado, as de cada agente com conta conectada (como o menu "Agente" do grupo). Conta sem login
// não entra, a não ser que seja a desta conversa (para ela continuar marcada).
function sectionsFor(auth: AuthState | null, providers: ProvidersState | null, multiAgents: boolean, currentId: string): Section[] {
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
  return sections
    .map((s) => ({ ...s, options: s.options.filter((o) => !o.signedOut || o.id === currentId) }))
    .filter((s) => s.options.length)
}

type Current = { id: string; icon: ReactNode; name: string; label: string }

// A conta que vale agora: a pedida ou, sem ela (ou removida), a padrão do agente. Null quando não
// há o que mostrar: com uma conta só do Claude e sem outros agentes, como a etiqueta do grupo.
// Exportado para o cabeçalho saber se a linha de baixo tem o selo.
export function useCurrentAccount(account?: string): Current | null {
  const auth = useAuth()
  const providers = useProviders()
  const multiAgents = usePreference('multiAgents')
  const agent = parseAgentRef(account)
  if (agent) {
    const { accounts, defaultId } = providers?.providers[agent.provider] ?? { accounts: [], defaultId: null }
    const chosen = accounts.find((a) => a.id === agent.account) ?? accounts.find((a) => a.id === defaultId)
    return {
      id: chosen ? agentRef(agent.provider, chosen.id) : account!,
      icon: <AgentIcon provider={agent.provider} size={12} />,
      name: `${PROVIDER_NAMES[agent.provider]}${chosen && accounts.length > 1 ? ` - ${chosen.name}` : ''}`,
      // Sem conta achada, o nome do agente.
      label: chosen?.name ?? PROVIDER_NAMES[agent.provider]
    }
  }
  if (!auth || (auth.accounts.length < 2 && !multiAgents)) return null
  const id = resolveAccount(auth, account)
  const chosen = auth.accounts.find((a) => a.id === id)
  if (!chosen) return null
  return { id, icon: <ClaudeIcon size={12} />, name: chosen.name, label: chosen.name }
}

// Conta que roda a conversa (logo do agente e nome), no cabeçalho, antes dos botões. Com `onChange`
// vira botão que abre o seletor; sem ele só mostra.
// claudeOnly: só as contas do Claude (conversa já começada e o terminal do `claude` trocam de
// conta, não de agente).
export function AccountTag({
  account,
  onChange,
  claudeOnly
}: {
  account?: string
  onChange?: (account: string) => void
  claudeOnly?: boolean
}) {
  const auth = useAuth()
  const providers = useProviders()
  const multiAgents = usePreference('multiAgents')
  const current = useCurrentAccount(account)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutsideClick(ref, () => setOpen(false), open)
  useEscape(() => setOpen(false), open)

  if (!current) return null
  const currentId = current.id
  const sections = sectionsFor(auth, providers, multiAgents && !claudeOnly, currentId)
  const total = sections.reduce((n, s) => n + s.options.length, 0)
  const content = (
    <>
      <span className="flex shrink-0">{current.icon}</span>
      <span className="truncate">{current.label}</span>
    </>
  )
  const title = tr(`Conta desta conversa: ${current.name}`, `Account for this chat: ${current.name}`)

  if (!onChange || total < 2)
    return (
      <span
        title={`${title}. ${tr('Dá para trocar com a conversa parada.', 'It can be changed while the chat is idle.')}`}
        className={`${TAG} min-w-0 max-w-40 shrink-0 gap-1`}
      >
        {content}
      </span>
    )

  return (
    // Clicar no logo não arrasta a janela (no-drag), o bloco no canvas (nodrag) nem o painel
    // (o pointerdown não sobe para o cabeçalho).
    <div ref={ref} onPointerDown={(e) => e.stopPropagation()} className="no-drag nodrag relative flex min-w-0 max-w-40 shrink-0">
      <button
        aria-expanded={open}
        aria-label={title}
        onClick={() => setOpen((o) => !o)}
        title={title}
        // A setinha mostra que dá para escolher; some depois do primeiro envio, junto com o seletor.
        className={`${TAG} min-w-0 gap-1 ${open ? 'bg-surface-2 text-text' : 'hover:bg-surface-2 hover:text-text'}`}
      >
        {content}
        <ChevronDown size={12} className="shrink-0" />
      </button>

      <Presence kind="menu">
        {open && (
          <div className={`absolute right-0 top-full z-50 mt-2.5 max-h-96 w-64 cursor-default overflow-y-auto ${POPOVER}`}>
            <MenuArrow side="top" align="end" />
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
