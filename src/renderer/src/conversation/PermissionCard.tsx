import { ShieldQuestion } from 'lucide-react'
import type { PermissionAnswer, PermissionRequest } from '../../../shared/chat'
import { DiffView } from './DiffView'
import { PlanCard } from './PlanCard'
import { QuestionCard } from './QuestionCard'
import { tr } from '../i18n'

// O Claude quer usar uma ferramenta (editar, rodar comando...) e espera a resposta.
export function PermissionCard({
  request,
  onAnswer
}: {
  request: PermissionRequest
  onAnswer: (answer: PermissionAnswer) => void
}) {
  if (request.questions?.length) {
    return (
      <QuestionCard
        questions={request.questions}
        onSubmit={(answers) => onAnswer({ answers })}
        onDismiss={() => onAnswer('deny')}
      />
    )
  }

  // Plano pronto esperando aprovação: o plano formatado, com os botões embaixo.
  if (request.toolName === 'ExitPlanMode' && request.detail) {
    return (
      <PlanCard plan={request.detail}>
        <div className="flex justify-end gap-1.5 text-xs">
          <button onClick={() => onAnswer('deny')} className="rounded-md border border-line-strong px-2.5 py-1 text-text hover:bg-bg">
            {tr('Negar', 'Deny')}
          </button>
          <button onClick={() => onAnswer('allow')} className="rounded-md bg-ask px-2.5 py-1 font-medium text-ask-text hover:brightness-110">
            {tr('Aprovar plano', 'Approve plan')}
          </button>
        </div>
      </PlanCard>
    )
  }

  return (
    <div className="rounded-lg border border-ask/40 bg-ask/10 p-3 text-xs">
      <div className="flex items-start gap-2">
        <ShieldQuestion size={14} className="mt-px shrink-0 text-ask" />
        <div className="min-w-0 flex-1">
          {/* A frase pronta do Claude Code vem em inglês; fica só como dica ao passar o mouse. */}
          <div className="font-medium text-text" title={request.title}>
            {request.label}
            {request.summary && <span className="font-normal text-muted"> - {request.summary}</span>}
          </div>
          {/* Para permitir, o detalhe técnico importa: o comando exato que vai rodar. */}
          {request.detail && (
            <div className="mt-1.5 max-h-28 overflow-auto whitespace-pre-wrap break-all rounded-md bg-bg px-2 py-1.5 font-mono text-[12px] text-muted">
              {request.detail}
            </div>
          )}
        </div>
      </div>
      {request.diff && (
        <div className="mt-2">
          <DiffView hunks={request.diff} />
        </div>
      )}
      <div className="mt-2.5 flex flex-wrap justify-end gap-1.5">
        <button
          onClick={() => onAnswer('deny')}
          className="rounded-md border border-line-strong px-2.5 py-1 text-text hover:bg-bg"
        >
          {tr('Negar', 'Deny')}
        </button>
        {request.canAlwaysAllow && (
          <button
            onClick={() => onAnswer('always')}
            className="rounded-md border border-line-strong px-2.5 py-1 text-text hover:bg-bg"
          >
            {tr('Sempre permitir', 'Always allow')}
          </button>
        )}
        <button onClick={() => onAnswer('allow')} className="rounded-md bg-ask px-2.5 py-1 font-medium text-ask-text hover:brightness-110">
          {tr('Permitir', 'Allow')}
        </button>
      </div>
    </div>
  )
}
