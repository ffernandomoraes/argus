import { useRef, useState } from 'react'
import { Brain, ChevronUp, Network, Workflow } from 'lucide-react'
import type { SessionSettings } from './SessionSettings'
import { EFFORTS, effortLabel } from './modelOptions'
import { parseAgentRef } from '../../../shared/providers'
import { resolveAccount, useAuth, useConversationAccount } from '../auth/useAuth'
import { useProviders } from '../providers/useProviders'
import { useAccountChoice } from './conversationAccount'
import { orchestratorFit } from './orchestrator'
import { useModels } from './useModels'
import { EffortDots, EffortSlider } from './composer/EffortSlider'
import { ModelList } from './composer/ModelList'
import { Toggle } from './composer/Toggle'
import { POPOVER } from './popover'
import { useEscape } from '../useEscape'
import { useOutsideClick } from '../useOutsideClick'
import { Presence } from '../motion'
import { MenuArrow } from '../ui/MenuArrow'
import { tr } from '../i18n'
import { getPreferences, usePreference } from '../settings/preferences'
import { ExperimentTag } from '../ui/ExperimentTag'

// Níveis de esforço e famílias de modelo moram em modelOptions.ts; saem daqui também, como antes,
// para as Configurações.
export { EFFORTS, groupByFamily } from './modelOptions'

// Igual à extensão do VS Code: botão com modelo e esforço embaixo do campo; o menu abre
// para cima com os modelos agrupados por família, a régua de esforço e as opções de
// thinking e Ultracode. A lista de modelos vem do próprio `claude` (ver useModels).
export function ModelEffortPicker({
  settings,
  onChange,
  dots: showDots = true
}: {
  settings: SessionSettings
  onChange: (patch: Partial<SessionSettings>) => void
  // Falso nas colunas estreitas (modo design): o esforço fica só escrito, sem as bolinhas.
  dots?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const models = useModels()
  // Outro agente (Codex, Gemini, Cursor): os modelos e esforços são os da conta dele; thinking e
  // Ultracode são do Claude Code. O orquestrador vale para todos (ver src/main/orchestration/).
  const account = useConversationAccount()
  const agent = !!parseAgentRef(account)
  const orchestratorEnabled = usePreference('orchestratorEnabled')
  // O orquestrador configurado cabe nesta conversa? Conversa vazia adota o agente dele; a que já
  // começou com outro agente não troca (o histórico de cada um é próprio dele).
  const orchestrator = usePreference('orchestrator')
  const auth = useAuth()
  const providers = useProviders()
  const choice = useAccountChoice()
  const fit = orchestratorFit(orchestrator.agent, account, !!choice?.empty, resolveAccount(auth, undefined), providers)
  useOutsideClick(ref, () => setOpen(false), open)
  useEscape(() => setOpen(false), open)

  // Modelo salvo que a conta não tem (um do Claude numa conversa do Codex): vale o padrão dela.
  const current = models.find((m) => m.value === settings.model) ?? (agent ? models.find((m) => m.value === '') : undefined)
  // Padrão mostra o modelo a que aponta hoje: "Opus 5.5".
  const currentName = current
    ? current.value === '' ? (current.resolvedName ?? tr('Padrão', 'Default')) : current.displayName
    : settings.model || tr('Padrão', 'Default')
  // Sem lista ainda, mostra a régua inteira; modelo sem esforço (Haiku) esconde a régua.
  const allowed = current ? EFFORTS.filter((e) => current.efforts.includes(e.value)) : EFFORTS
  const dots = EFFORTS.findIndex((e) => e.value === settings.effort) + 1

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title={tr(
          `Modelo: ${currentName} - Esforço: ${allowed.length ? effortLabel(settings.effort) : 'não se aplica'}`,
          `Model: ${currentName} - Effort: ${allowed.length ? effortLabel(settings.effort) : 'not applicable'}`
        )}
        className={`flex items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-surface-2 hover:text-text ${
          open ? 'bg-surface-2 text-text' : 'text-muted'
        }`}
      >
        <span>{currentName}</span>
        {allowed.length > 0 && (
          <>
            {showDots && <EffortDots level={dots} />}
            <span className="text-faint">{effortLabel(settings.effort)}</span>
          </>
        )}
        {settings.ultracode && !agent && <Workflow size={12} className="text-running" aria-label={tr('Ultracode ligado', 'Ultracode on')} />}
        {orchestratorEnabled && settings.orchestrator && <Network size={12} className="text-running" aria-label={tr('Orquestrador ligado', 'Orchestrator on')} />}
        <ChevronUp size={12} className="text-faint" />
      </button>

      <Presence kind="menu">
        {open && (
          <div className={`absolute bottom-full right-0 z-10 mb-2.5 w-72 whitespace-normal ${POPOVER}`}>
            <MenuArrow side="bottom" align="end" />
            <ModelList models={models} value={settings.model} onChange={(model) => onChange({ model })} />
            {allowed.length > 0 && (
              <>
                <div className="my-1 h-px bg-line" />
                <EffortSlider allowed={allowed} value={settings.effort} onChange={(effort) => onChange({ effort })} />
              </>
            )}
            {!agent && <div className="my-1 h-px bg-line" />}
            {!agent && <Toggle
              label="Thinking"
              icon={<Brain size={12} />}
              checked={settings.thinking}
              onChange={(thinking) => onChange({ thinking })}
            />}
            {!agent && <Toggle
              label="Ultracode"
              icon={<Workflow size={12} />}
              checked={settings.ultracode}
              onChange={(ultracode) => onChange({ ultracode })}
            />}
            {orchestratorEnabled && (
              <Toggle
                label={tr('Orquestrador', 'Orchestrator')}
                tag={<ExperimentTag />}
                icon={<Network size={12} />}
                checked={settings.orchestrator}
                disabled={fit.kind === 'blocked' && !settings.orchestrator}
                note={
                  fit.kind === 'blocked' &&
                  tr(
                    `Esta conversa começou com outro agente. Para usar o orquestrador atual (${fit.agent}), inicie uma conversa nova.`,
                    `This chat started with another agent. To use the current orchestrator (${fit.agent}), start a new chat.`
                  )
                }
                onChange={(on) => {
                  // Ligar põe a conversa no agente (se vazia), modelo e esforço do orquestrador;
                  // desligar mantém os atuais.
                  if (!on) return onChange({ orchestrator: false })
                  const o = getPreferences().orchestrator
                  if (fit.kind === 'blocked') return
                  if (fit.kind === 'adopt') choice?.choose(fit.account)
                  onChange({ orchestrator: true, model: o.model, effort: o.effort })
                }}
              />
            )}
          </div>
        )}
      </Presence>
    </div>
  )
}
