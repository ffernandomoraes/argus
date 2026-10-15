import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Download } from 'lucide-react'
import { agentProviderName, type AgentDef, type AgentProvider } from '../../../shared/agents'
import { POPOVER } from '../conversation/popover'
import { Presence } from '../motion'
import { Button } from '../ui/Button'
import { MenuArrow } from '../ui/MenuArrow'
import { MENU_HOVER } from '../ui/menuStyles'
import { useEscape } from '../useEscape'
import { useOutsideClick } from '../useOutsideClick'
import { ProviderLogo } from './ProviderLogo'
import { tr } from '../i18n'

type Library = { provider: AgentProvider; agents: AgentDef[] }

// "Importar": os agentes globais dos outros provedores, para começar um agente novo daqui a
// partir de um deles. Lidos ao abrir o menu.
export function ImportMenu({ others, onPick }: { others: AgentProvider[]; onPick: (agent: AgentDef) => void }) {
  const [open, setOpen] = useState(false)
  const [libraries, setLibraries] = useState<Library[] | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  useOutsideClick(ref, () => setOpen(false), open)
  useEscape(() => setOpen(false), open)

  useEffect(() => {
    if (!open) return
    let alive = true
    setLibraries(null)
    Promise.all(others.map(async (provider) => ({ provider, agents: await window.api.agents.list(provider).catch(() => []) }))).then(
      (list) => alive && setLibraries(list.filter((l) => l.agents.length))
    )
    return () => {
      alive = false
    }
  }, [open, others])

  return (
    <div ref={ref} className="relative">
      <Button size="lg" variant="secondary" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Download size={12} />
        {tr('Importar', 'Import')}
        <ChevronDown size={12} />
      </Button>
      <Presence kind="menu">
        {open && (
          <div className={`absolute right-0 top-full z-50 mt-2.5 max-h-96 w-72 overflow-y-auto ${POPOVER}`}>
            <MenuArrow side="top" align="end" />
            {libraries && !libraries.length && (
              <p className="px-2 py-2 text-[12px] leading-snug text-faint">
                {tr('Os outros agentes ainda não têm agentes na biblioteca.', 'The other agents have nothing in their libraries yet.')}
              </p>
            )}
            {libraries?.map((l) => (
              <div key={l.provider}>
                <div className="flex items-center gap-1.5 px-2 pb-1 pt-1.5 text-[12px] text-faint">
                  <ProviderLogo provider={l.provider} size={12} />
                  {agentProviderName(l.provider)}
                </div>
                {l.agents.map((a) => (
                  <button
                    key={a.path}
                    title={a.description}
                    onClick={() => {
                      onPick(a)
                      setOpen(false)
                    }}
                    className={`flex w-full items-center rounded-md px-2 py-1 text-left text-xs ${MENU_HOVER}`}
                  >
                    <span className="min-w-0 flex-1 truncate text-text">{a.name}</span>
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
