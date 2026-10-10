import { ArrowLeft, ArrowRight } from 'lucide-react'
import { keys } from '../platform'
import { Button } from '../ui/Button'
import { LAST_STEP, type Draft } from './agentDraft'
import { InstructionsStep } from './InstructionsStep'
import { StepTabs } from './StepTabs'
import { ToolsStep } from './ToolsStep'

// Agente aberto: as abas dos passos, o passo atual e o rodapé com Voltar, Salvar e Continuar.
export function AgentEditor({
  draft,
  step,
  reached,
  error,
  dirty,
  lacking,
  canSave,
  onGo,
  onBack,
  onSave,
  onChange,
  onToggleTool
}: {
  draft: Draft
  step: number
  reached: number
  error: string | null
  dirty: boolean
  // Campos obrigatórios ainda vazios.
  lacking: string[]
  canSave: boolean
  onGo: (step: number) => void
  // Voltar na primeira aba: de volta para a lista de agentes.
  onBack: () => void
  onSave: () => void
  onChange: (patch: Partial<Draft>) => void
  onToggleTool: (name: string) => void
}) {
  return (
    <>
      <StepTabs step={step} reached={reached} onGo={onGo} />
      {error && <p className="border-b border-line px-5 py-2 text-xs text-red-400">{error}</p>}

      {step === 0 && <InstructionsStep draft={draft} onChange={onChange} />}
      {step === 1 && <ToolsStep draft={draft} onChange={onChange} onToggleTool={onToggleTool} />}

      <footer className="flex items-center gap-2 border-t border-line px-5 py-3">
        {/* Na primeira aba, Voltar leva de volta para a lista de agentes. */}
        <Button size="lg" variant="subtle" onClick={() => (step > 0 ? onGo(step - 1) : onBack())}>
          <ArrowLeft size={12} />
          Voltar
        </Button>
        <span className="flex-1" />
        {lacking.length > 0 && <span className="text-[12px] text-faint">Falta preencher: {lacking.join(', ')}</span>}
        <Button
          size="lg"
          variant={step < LAST_STEP ? 'secondary' : 'primary'}
          onClick={onSave}
          disabled={!canSave}
          title={lacking.length ? `Falta preencher: ${lacking.join(', ')}` : `Salvar (${keys('⌘S')})`}
        >
          {draft.previousName && !dirty ? 'Salvo' : 'Salvar'}
        </Button>
        {step < LAST_STEP && (
          <Button size="lg" variant="primary" onClick={() => onGo(step + 1)} disabled={lacking.length > 0}>
            Continuar
            <ArrowRight size={12} />
          </Button>
        )}
      </footer>
    </>
  )
}
