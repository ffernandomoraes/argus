import { useRef, useState } from 'react'
import { ChevronUp, Network, Workflow } from 'lucide-react'
import type { SessionSettings } from './SessionSettings'
import { EFFORTS, effortLabel } from './modelOptions'
import { parseAgentRef } from '../../../shared/providers'
import { useConversationAccount } from '../auth/useAuth'
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
  // Outro agente (Codex, Gemini, Cursor): os modelos e esforços são os da conta dele; thinking,
  // Ultracode e orquestrador são do Claude Code.
  const agent = !!parseAgentRef(useConversationAccount())
  const orchestratorEnabled = usePreference('orchestratorEnabled') && !agent
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
              description={tr(
                'Pensa antes de responder. Respostas melhores em tarefas difíceis, um pouco mais lentas.',
                'Thinks before responding. Better answers on hard tasks, a bit slower.'
              )}
              checked={settings.thinking}
              onChange={(thinking) => onChange({ thinking })}
            />}
            {!agent && <Toggle
              label="Ultracode"
              icon={<Workflow size={12} />}
              description={tr(
                'Usa vários subagentes em paralelo em toda tarefa, só nesta sessão. Gasta bem mais tokens.',
                'Uses multiple subagents in parallel on every task, for this session only. Uses many more tokens.'
              )}
              checked={settings.ultracode}
              onChange={(ultracode) => onChange({ ultracode })}
            />}
            {orchestratorEnabled && (
              <Toggle
                label={tr('Orquestrador', 'Orchestrator')}
                tag={<ExperimentTag />}
                icon={<Network size={12} />}
                description={tr(
                  'Não executa: divide o pedido em etapas e manda cada uma ao modelo e esforço que ela pede. Regras em Configurações > Orquestrador.',
                  'Doesn’t do the work: splits the request into steps and sends each to the model and effort it needs. Rules in Settings > Orchestrator.'
                )}
                checked={settings.orchestrator}
                onChange={(on) => {
                  // Ligar põe a sessão no modelo e esforço do orquestrador; desligar mantém os atuais.
                  const o = getPreferences().orchestrator
                  onChange(on ? { orchestrator: true, model: o.model, effort: o.effort } : { orchestrator: false })
                }}
              />
            )}
          </div>
        )}
      </Presence>
    </div>
  )
}
