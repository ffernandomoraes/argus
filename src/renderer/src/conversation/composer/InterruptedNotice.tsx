import { X } from 'lucide-react'
import type { InterruptReason } from '../../../../shared/chat'
import { tr } from '../../i18n'

// O que vai ao Claude no "Continuar de onde parou".
export const CONTINUE_TEXT = tr('Continue de onde parou.', 'Continue where you left off.')

// Por que parou: o Argus fechou no meio (atualização, ⌘Q, queda), ou o sistema encerrou o Claude
// por falta de memória.
const reasonText = (reason?: InterruptReason) =>
  reason === 'memory'
    ? tr('Parou por falta de memória.', 'Stopped for lack of memory.')
    : tr('Interrompida quando o Argus fechou.', 'Interrupted when Argus quit.')

// Conversa que parou no meio sem você pedir: no pé da conversa, em cima da caixa de escrever, o
// aviso e o botão que manda o Claude continuar, como mensagem sua. O X só tira a marca; mandar
// qualquer mensagem também tira.
export function InterruptedNotice({ reason, onContinue, onDismiss }: { reason?: InterruptReason; onContinue: () => void; onDismiss: () => void }) {
  return (
    <div className="flex items-center gap-2 px-4 pb-2">
      <span className="size-1.5 shrink-0 rounded-full bg-interrupted" aria-hidden="true" />
      <span className="min-w-0 truncate text-xs text-muted">
        {reasonText(reason)}
      </span>
      <button
        onClick={onContinue}
        className="flex h-6 shrink-0 items-center rounded-md bg-interrupted/15 px-2 text-xs text-text hover:bg-interrupted/25"
      >
        {tr('Continuar de onde parou', 'Continue where it left off')}
      </button>
      <button
        onClick={onDismiss}
        title={tr('Dispensar', 'Dismiss')}
        aria-label={tr('Dispensar', 'Dismiss')}
        className="ml-auto flex size-6 shrink-0 items-center justify-center rounded-md text-faint hover:bg-fill hover:text-text"
      >
        <X size={13} />
      </button>
    </div>
  )
}

// Conversa que o Argus fechou, parada e fora da tela, para liberar memória: explica por que a
// primeira resposta demora (o Claude abre de novo). Sai quando ela volta a trabalhar.
export function FreedNotice() {
  return (
    <div className="flex items-center gap-2 px-4 pb-2">
      <span className="size-1.5 shrink-0 rounded-full bg-needs-you" aria-hidden="true" />
      <span className="min-w-0 text-xs text-muted">
        {tr(
          'Fechada para liberar memória. A primeira resposta demora uns segundos a mais.',
          'Closed to free up memory. The first reply takes a few seconds longer.'
        )}
      </span>
    </div>
  )
}
