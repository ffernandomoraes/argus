import type { AgentProvider } from '../../../shared/agents'
import { stepsFor } from './agentDraft'
import { tr } from '../i18n'

// Abas do agente. No agente novo, a seguinte só abre depois desta. Com um passo só, sem abas.
export function StepTabs({ provider, step, reached, onGo }: { provider: AgentProvider; step: number; reached: number; onGo: (step: number) => void }) {
  const steps = stepsFor(provider)
  if (steps.length < 2) return null
  return (
    <div role="tablist" className="flex gap-6 border-b border-line px-5">
      {steps.map((label, i) => {
        const active = i === step
        const enabled = i <= reached
        return (
          <button
            key={label}
            role="tab"
            aria-selected={active}
            disabled={!enabled}
            onClick={() => onGo(i)}
            title={enabled ? undefined : tr('Preencha as instruções primeiro', 'Fill in the instructions first')}
            className={`-mb-px border-b-2 py-2.5 text-[13px] ${
              active ? 'border-accent font-medium text-text' : enabled ? 'border-transparent text-muted hover:text-text' : 'border-transparent text-faint'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
