import { useEscape } from '../useEscape'

// Sem onConfirm, é um aviso de bloqueio: só o botão de fechar.
export type ConfirmRequest = {
  title: string
  description: string
  confirmLabel?: string
  onConfirm?: () => void
  // Sem "action", o botão de confirmar é vermelho (apagar, descartar); com ele, azul de ação.
  tone?: 'action'
}

export function ConfirmDialog({ request, onClose }: { request: ConfirmRequest; onClose: () => void }) {
  useEscape(onClose)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onMouseDown={onClose}>
      <div
        role="alertdialog"
        aria-labelledby="confirm-title"
        onMouseDown={(e) => e.stopPropagation()}
        className="w-96 rounded-2xl border border-line bg-surface p-5 shadow-2xl shadow-black/60"
      >
        <h2 id="confirm-title" className="text-sm font-semibold">
          {request.title}
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-muted">{request.description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            autoFocus
            onClick={onClose}
            className="rounded-md border border-line bg-fill px-3.5 py-1 text-xs text-text hover:bg-surface-2"
          >
            {request.onConfirm ? 'Cancelar' : 'Entendi'}
          </button>
          {request.onConfirm && (
            <button
              onClick={() => {
                request.onConfirm?.()
                onClose()
              }}
              className={`rounded-md px-3.5 py-1 text-xs font-medium text-white ${
                request.tone === 'action' ? 'bg-accent hover:brightness-110' : 'bg-red-500 hover:bg-red-600'
              }`}
            >
              {request.confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
