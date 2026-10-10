import { useState } from 'react'
import { Check, Copy, ExternalLink, Loader2, Smartphone, X } from 'lucide-react'
import { ConfirmDialog } from '../canvas/ConfirmDialog'
import type { RemoteControl } from '../../../shared/chat'
import { useCopied } from '../lib/useCopied'
import { Presence } from '../motion'

const ACTION = 'flex items-center gap-1 rounded-md px-1 text-faint hover:text-text'

// Linha discreta acima do campo de texto enquanto o remote control está ligado (/remote-control).
export function RemoteControlBar({ remote, onTurnOff }: { remote: RemoteControl; onTurnOff: () => void }) {
  const { copied, copy } = useCopied()
  const [confirming, setConfirming] = useState(false)
  // Falhou: não há conexão a perder, então o X só tira a faixa.
  const turnOff = () => (remote.status === 'failed' ? onTurnOff() : setConfirming(true))

  const label =
    remote.status === 'connected'
      ? 'Remote control ligado'
      : remote.status === 'failed'
        ? `Remote control não conectou${remote.detail ? `: ${remote.detail}` : '.'}`
        : 'Ligando remote control…'

  return (
    <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[12px] text-faint">
      {remote.status === 'connecting' ? (
        <Loader2 size={11} className="shrink-0 animate-spin" />
      ) : (
        <Smartphone size={11} className={`shrink-0 ${remote.status === 'failed' ? 'text-red-400' : 'text-done'}`} />
      )}
      <span className={`min-w-0 flex-1 truncate ${remote.status === 'failed' ? 'text-red-400' : ''}`} title={label}>
        {label}
      </span>
      {remote.url && remote.status !== 'failed' && (
        <>
          <a href={remote.url} target="_blank" rel="noreferrer" className={ACTION}>
            <ExternalLink size={11} />
            Abrir
          </a>
          <button onClick={() => remote.url && copy(remote.url)} className={ACTION}>
            {copied ? <Check size={11} /> : <Copy size={11} />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </>
      )}
      <button onClick={turnOff} aria-label="Desligar remote control" title="Desligar remote control" className={ACTION}>
        <X size={11} />
      </button>
      <Presence kind="modal">
        {confirming && (
          <ConfirmDialog
            request={{
              title: 'Desligar o remote control?',
              description:
                'Pelo claude.ai e pelo celular não dá mais para continuar esta conversa. Aqui no app ela segue normal, e /remote-control liga de novo.',
              confirmLabel: 'Desligar',
              onConfirm: onTurnOff
            }}
            onClose={() => setConfirming(false)}
          />
        )}
      </Presence>
    </div>
  )
}
