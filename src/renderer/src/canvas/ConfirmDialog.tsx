import { useEffect } from 'react'

export type ConfirmRequest = {
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => void
}

export function ConfirmDialog({ request, onClose }: { request: ConfirmRequest; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onMouseDown={onClose}>
      <div
        role="alertdialog"
        aria-labelledby="confirm-title"
        onMouseDown={(e) => e.stopPropagation()}
        className="w-96 rounded-xl border border-line bg-surface p-5 shadow-2xl shadow-black/60"
      >
        <h2 id="confirm-title" className="text-sm font-semibold">
          {request.title}
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-muted">{request.description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            autoFocus
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-xs text-muted hover:bg-surface-2 hover:text-text"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              request.onConfirm()
              onClose()
            }}
            className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600"
          >
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
