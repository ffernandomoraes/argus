import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, Smartphone, X } from 'lucide-react'
import { ConfirmDialog } from '../canvas/ConfirmDialog'
import type { RemoteControl } from '../../../shared/chat'
import { TAG } from './header/BranchTag'
import { Presence } from '../motion'
import { tr } from '../i18n'

// Remote control ligado (/remote-control), discreto na linha em cima da caixa de escrever, antes da
// branch: no estilo do botão do código, com o X para desligar.
export function RemoteControlTag({ remote, onTurnOff }: { remote: RemoteControl; onTurnOff: () => void }) {
  const [confirming, setConfirming] = useState(false)
  // Falhou: não há conexão a perder, então o X só tira o aviso.
  const turnOff = () => (remote.status === 'failed' ? onTurnOff() : setConfirming(true))
  const failed = remote.status === 'failed'

  const label =
    remote.status === 'connected'
      ? tr('Controle remoto ligado', 'Remote control on')
      : failed
        ? tr('Controle remoto não conectou', 'Remote control didn’t connect')
        : tr('Ligando o controle remoto…', 'Turning on remote control…')
  const title = failed && remote.detail ? `${label}: ${remote.detail}` : label

  return (
    <span title={title} className={`${TAG} shrink-0 gap-1.5 whitespace-nowrap ${failed ? 'text-red-400' : ''}`}>
      {remote.status === 'connecting' ? (
        <Loader2 size={13} className="shrink-0 animate-spin" />
      ) : (
        <Smartphone size={13} className={`shrink-0 ${failed ? '' : 'text-done'}`} />
      )}
      <span>{label}</span>
      <button
        onClick={turnOff}
        aria-label={tr('Desligar o controle remoto', 'Turn off remote control')}
        title={tr('Desligar o controle remoto', 'Turn off remote control')}
        className="-mr-0.5 flex size-4 shrink-0 items-center justify-center rounded hover:bg-surface-2 hover:text-text"
      >
        <X size={12} />
      </button>
      {/* No body: dentro da etiqueta, o modal herdava o nowrap (o texto passava da caixa) e a cor
          apagada dela, e ficava preso ao painel da conversa em vez de centrar na janela. */}
      {createPortal(
        <Presence kind="modal">
          {confirming && (
            <ConfirmDialog
              request={{
                title: tr('Desligar o controle remoto?', 'Turn off remote control?'),
                // \u2011: hífen que não quebra linha, para "/remote-control" não partir no meio.
                description:
                  tr(
                    'Pelo claude.ai e pelo celular não dá mais para continuar esta conversa. Aqui no app ela segue normal, e /remote\u2011control liga de novo.',
                    'You won’t be able to continue this chat on claude.ai or your phone. It keeps working here in the app, and /remote\u2011control turns it back on.'
                  ),
                confirmLabel: tr('Desligar', 'Turn off'),
                onConfirm: onTurnOff
              }}
              onClose={() => setConfirming(false)}
            />
          )}
        </Presence>,
        document.body
      )}
    </span>
  )
}
