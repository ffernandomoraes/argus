import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { PROVIDERS } from '../../../shared/providers'
import { ConfirmDialog, type ConfirmRequest } from '../canvas/ConfirmDialog'
import { AgentIcon } from '../icons/AgentIcon'
import { Presence } from '../motion'
import { useProviders } from '../providers/useProviders'
import { ProviderSection } from '../settings/accounts/ProviderSection'
import { setPreferences, usePreference } from '../settings/preferences'
import { ExperimentTag } from '../ui/ExperimentTag'
import { tr } from '../i18n'

// Na configuração das boas-vindas: entrar com o Codex, o Gemini ou o Cursor no lugar do Claude.
// Abrir liga o experimento deles (são as mesmas seções de Configurações > Contas).
export function OtherAgents() {
  const multiAgents = usePreference('multiAgents')
  const providers = useProviders()
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)

  // Aberto agora (ou já estava ligado): confere instalação e contas de cada um.
  useEffect(() => {
    if (multiAgents) window.api.providers.refresh()
  }, [multiAgents])

  if (!multiAgents) {
    return (
      <button
        onClick={() => setPreferences({ multiAgents: true })}
        className="mt-4 flex w-full items-center gap-3 rounded-lg border border-line px-3 py-2.5 text-left hover:bg-surface-2"
      >
        <span className="flex shrink-0 gap-1.5 text-muted">
          {PROVIDERS.map((p) => (
            <AgentIcon key={p} provider={p} size={14} />
          ))}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-sm text-text">
            {tr('Usar outro agente', 'Use another agent')}
            <ExperimentTag />
          </span>
          <span className="block text-xs text-faint">{tr('Codex, Gemini ou Cursor, no lugar do Claude.', 'Codex, Gemini or Cursor, instead of Claude.')}</span>
        </span>
        <ChevronRight size={14} className="shrink-0 text-faint" />
      </button>
    )
  }

  return (
    <div className="mt-6 border-t border-line">
      <p className="mt-4 text-xs leading-relaxed text-faint">
        {tr(
          'Ou conecte outro agente. Com o Claude sem configurar, as pastas usam o primeiro conectado; cada grupo do canvas pode escolher o seu.',
          'Or connect another agent. Without Claude set up, folders use the first one connected; each canvas group can choose its own.'
        )}
      </p>
      {providers ? (
        PROVIDERS.map((p) => <ProviderSection key={p} provider={p} state={providers} onConfirm={setConfirm} />)
      ) : (
        <p className="mt-4 text-xs text-faint">{tr('Conferindo os agentes…', 'Checking agents…')}</p>
      )}
      <Presence kind="modal">{confirm && <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />}</Presence>
    </div>
  )
}
