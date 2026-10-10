import { STEPS } from './agentDraft'

// Abas do agente. No agente novo, a seguinte só abre depois desta.
export function StepTabs({ step, reached, onGo }: { step: number; reached: number; onGo: (step: number) => void }) {
  return (
    <div role="tablist" className="flex gap-6 border-b border-line px-5">
      {STEPS.map((label, i) => {
        const active = i === step
        const enabled = i <= reached
        return (
          <button
            key={label}
            role="tab"
            aria-selected={active}
            disabled={!enabled}
            onClick={() => onGo(i)}
            title={enabled ? undefined : 'Preencha as instruções primeiro'}
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
