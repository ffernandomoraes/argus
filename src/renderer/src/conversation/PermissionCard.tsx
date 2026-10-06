import { ShieldQuestion } from 'lucide-react'
import type { PermissionAnswer, PermissionRequest } from '../../../shared/chat'
import { DiffView } from './DiffView'
import { QuestionCard } from './QuestionCard'

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

  return (
    <div className="rounded-lg border border-needs-you/40 bg-needs-you/10 p-3 text-xs">
      <div className="flex items-start gap-2">
        <ShieldQuestion size={14} className="mt-px shrink-0 text-needs-you" />
        <div className="min-w-0 flex-1">
          {/* A frase pronta do Claude Code vem em inglês; fica só como dica ao passar o mouse. */}
          <div className="font-medium text-text" title={request.title}>
            {request.label}
            {request.summary && <span className="font-normal text-muted"> · {request.summary}</span>}
          </div>
          {/* Para permitir, o detalhe técnico importa: o comando exato que vai rodar. */}
          {request.detail && (
            <div className="mt-1.5 max-h-28 overflow-auto whitespace-pre-wrap break-all rounded-md bg-bg px-2 py-1.5 font-mono text-[11px] text-muted">
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
          className="rounded-md border border-line px-2.5 py-1 text-text hover:bg-surface-2"
        >
          Negar
        </button>
        {request.canAlwaysAllow && (
          <button
            onClick={() => onAnswer('always')}
            className="rounded-md border border-line px-2.5 py-1 text-text hover:bg-surface-2"
          >
            Sempre permitir
          </button>
        )}
        <button onClick={() => onAnswer('allow')} className="rounded-md bg-text px-2.5 py-1 font-medium text-bg hover:opacity-85">
          Permitir
        </button>
      </div>
    </div>
  )
}
