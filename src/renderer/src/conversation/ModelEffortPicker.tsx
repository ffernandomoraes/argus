import { useRef, useState } from 'react'
import { ChevronUp, Workflow } from 'lucide-react'
import type { SessionSettings } from './SessionSettings'
import { EFFORTS, effortLabel } from './modelOptions'
import { useModels } from './useModels'
import { EffortDots, EffortSlider } from './composer/EffortSlider'
import { ModelList } from './composer/ModelList'
import { Toggle } from './composer/Toggle'
import { POPOVER } from './popover'
import { useEscape } from '../useEscape'
import { useOutsideClick } from '../useOutsideClick'
import { Presence } from '../motion'

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
  useOutsideClick(ref, () => setOpen(false), open)
  useEscape(() => setOpen(false), open)

  const current = models.find((m) => m.value === settings.model)
  // Padrão mostra o modelo a que aponta hoje: "Opus 5.5".
  const currentName = current
    ? current.value === '' ? (current.resolvedName ?? 'Padrão') : current.displayName
    : settings.model || 'Padrão'
  // Sem lista ainda, mostra a régua inteira; modelo sem esforço (Haiku) esconde a régua.
  const allowed = current ? EFFORTS.filter((e) => current.efforts.includes(e.value)) : EFFORTS
  const dots = EFFORTS.findIndex((e) => e.value === settings.effort) + 1

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title={`Modelo: ${currentName} - Esforço: ${allowed.length ? effortLabel(settings.effort) : 'não se aplica'}`}
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
        {settings.ultracode && <Workflow size={12} className="text-running" aria-label="Ultracode ligado" />}
        <ChevronUp size={12} className="text-faint" />
      </button>

      <Presence kind="menu">
        {open && (
          <div className={`absolute bottom-full left-0 z-10 mb-2 w-72 whitespace-normal ${POPOVER}`}>
            <ModelList models={models} value={settings.model} onChange={(model) => onChange({ model })} />
            {allowed.length > 0 && (
              <>
                <div className="my-1 h-px bg-line" />
                <EffortSlider allowed={allowed} value={settings.effort} onChange={(effort) => onChange({ effort })} />
              </>
            )}
            <div className="my-1 h-px bg-line" />
            <Toggle
              label="Thinking"
              description="Pensa antes de responder. Respostas melhores em tarefas difíceis, um pouco mais lentas."
              checked={settings.thinking}
              onChange={(thinking) => onChange({ thinking })}
            />
            <Toggle
              label="Ultracode"
              icon={<Workflow size={12} />}
              description="Usa vários subagentes em paralelo em toda tarefa, só nesta sessão. Gasta bem mais tokens."
              checked={settings.ultracode}
              onChange={(ultracode) => onChange({ ultracode })}
            />
          </div>
        )}
      </Presence>
    </div>
  )
}
