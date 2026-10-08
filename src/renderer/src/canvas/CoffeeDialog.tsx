import { useEffect, useState } from 'react'
import { Check, Copy, X } from 'lucide-react'
import QRCode from 'qrcode'
import { useEscape } from '../useEscape'

const PIX_KEY = '772b807a-f1e6-4796-827e-185ca87573b5'
const PIX_NAME = 'FERNANDO MORAES LIMA'
// Obrigatória no padrão do Pix, mas o banco não confere: só aparece para quem paga.
const PIX_CITY = 'SAO PAULO'

// Campo do BR Code (padrão EMV do Banco Central): id + tamanho com 2 dígitos + valor.
const field = (id: string, value: string) => `${id}${String(value.length).padStart(2, '0')}${value}`

// CRC16-CCITT (polinômio 0x1021, início 0xFFFF), calculado sobre tudo até o "6304" inclusive.
function crc16(payload: string): string {
  let crc = 0xffff
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let bit = 0; bit < 8; bit++) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
    crc &= 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

// Pix estático sem valor: quem paga escolhe quanto. É o mesmo texto do "Pix copia e cola".
const PIX_PAYLOAD = (() => {
  const body =
    field('00', '01') +
    field('26', field('00', 'BR.GOV.BCB.PIX') + field('01', PIX_KEY)) +
    field('52', '0000') +
    field('53', '986') +
    field('58', 'BR') +
    field('59', PIX_NAME) +
    field('60', PIX_CITY) +
    field('62', field('05', '***')) +
    '6304'
  return body + crc16(body)
})()

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timer)
  }, [copied])

  return (
    <button
      onClick={() => navigator.clipboard.writeText(text).then(() => setCopied(true))}
      className="flex w-full items-center justify-center gap-1.5 rounded-full border border-line bg-fill px-3.5 py-1.5 text-xs text-text hover:bg-surface-2"
    >
      {copied ? <Check size={12} className="text-done" /> : <Copy size={12} />}
      {copied ? 'Copiado' : label}
    </button>
  )
}

export function CoffeeDialog({ onClose }: { onClose: () => void }) {
  useEscape(onClose)
  const [qr, setQr] = useState<string | null>(null)

  useEffect(() => {
    QRCode.toString(PIX_PAYLOAD, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' }).then(setQr)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-labelledby="coffee-title"
        onMouseDown={(e) => e.stopPropagation()}
        className="relative flex w-80 flex-col items-center rounded-2xl border border-line bg-surface p-5 text-center shadow-2xl shadow-black/60"
      >
        <button
          aria-label="Fechar"
          title="Fechar"
          onClick={onClose}
          className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full text-muted hover:bg-fill hover:text-text"
        >
          <X size={15} />
        </button>
        {/* Recuo à direita para o título não passar por baixo do X. */}
        <div className="w-full pr-8 text-left">
          <h2 id="coffee-title" className="text-sm font-semibold">
            Me pague um café
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            Se o Argus te ajuda no dia a dia, um Pix de qualquer valor ajuda a manter o projeto.
          </p>
        </div>
        {/* Fundo branco também no tema escuro: leitor de QR Code precisa de contraste claro. */}
        <div className="mt-4 rounded-xl bg-white p-3">
          {qr ? (
            <div className="size-44 [&>svg]:block [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: qr }} />
          ) : (
            <div className="size-44" />
          )}
        </div>
        <p className="mt-3 text-xs font-medium text-text">Fernando Moraes Lima - Nubank</p>
        <p className="mt-1 font-mono text-[11px] break-all text-faint select-text">{PIX_KEY}</p>
        <div className="mt-4 flex w-full flex-col gap-2">
          <CopyButton text={PIX_KEY} label="Copiar chave" />
          <CopyButton text={PIX_PAYLOAD} label="Pix copia e cola" />
        </div>
      </div>
    </div>
  )
}
