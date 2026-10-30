import { X } from 'lucide-react'
import { tr } from '../../i18n'

// O que vai ao Claude no "Continuar de onde parou".
export const CONTINUE_TEXT = tr('Continue de onde parou.', 'Continue where you left off.')

// Conversa que o Argus fechou no meio (atualização, ⌘Q, queda): no pé da conversa, em cima da caixa
// de escrever, o aviso e o botão que manda o Claude continuar, como mensagem sua. O X só tira a
// marca; mandar qualquer mensagem também tira.
export function InterruptedNotice({ onContinue, onDismiss }: { onContinue: () => void; onDismiss: () => void }) {
  return (
    <div className="flex items-center gap-2 px-4 pb-2">
      <span className="size-1.5 shrink-0 rounded-full bg-interrupted" aria-hidden="true" />
      <span className="min-w-0 truncate text-xs text-muted">
        {tr('Interrompida quando o Argus fechou.', 'Interrupted when Argus quit.')}
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
