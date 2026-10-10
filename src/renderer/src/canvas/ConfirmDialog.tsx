import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

// Sem onConfirm, é um aviso de bloqueio: só o botão de fechar.
export type ConfirmRequest = {
  title: string
  description: string
  confirmLabel?: string
  onConfirm?: () => void
  // Sem "action", o botão de confirmar é vermelho (apagar, descartar); com ele, azul de ação.
  tone?: 'action'
}

// Confirmação pequena no meio da tela. Esc e clique fora cancelam; o foco começa no Cancelar,
// para um Enter apressado não apagar nada.
export function ConfirmDialog({ request, onClose }: { request: ConfirmRequest; onClose: () => void }) {
  return (
    <Modal variant="alert" labelledBy="confirm-title" onClose={onClose}>
      <h2 id="confirm-title" className="text-sm font-semibold">
        {request.title}
      </h2>
      <p className="mt-2 text-xs leading-relaxed text-muted">{request.description}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button autoFocus onClick={onClose}>
          {request.onConfirm ? 'Cancelar' : 'Entendi'}
        </Button>
        {request.onConfirm && (
          <Button
            variant="primary"
            danger={request.tone !== 'action'}
            onClick={() => {
              request.onConfirm?.()
              onClose()
            }}
          >
            {request.confirmLabel}
          </Button>
        )}
      </div>
    </Modal>
  )
}
