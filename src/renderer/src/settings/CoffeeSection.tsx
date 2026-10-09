import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import QRCode from 'qrcode'

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
      className="flex w-full items-center justify-center gap-1.5 rounded-md border border-line bg-fill px-3.5 py-1.5 text-xs text-text hover:bg-surface-2"
    >
      {copied ? <Check size={12} className="text-done" /> : <Copy size={12} />}
      {copied ? 'Copiado' : label}
    </button>
  )
}

// Seção "Me pague um café" das configurações: QR Code do Pix, chave e os botões de copiar. O
// cabeçalho da seção (SettingsPage) já traz o título e o convite.
export function CoffeeSection() {
  const [qr, setQr] = useState<string | null>(null)

  useEffect(() => {
    QRCode.toString(PIX_PAYLOAD, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' }).then(setQr)
  }, [])

  return (
    <div className="flex flex-col items-center rounded-xl bg-fill px-6 py-6 text-center">
      {/* Fundo branco também no tema escuro: leitor de QR Code precisa de contraste claro. */}
      <div className="rounded-xl bg-white p-3">
        {qr ? (
          <div className="size-44 [&>svg]:block [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: qr }} />
        ) : (
          <div className="size-44" />
        )}
      </div>
      <p className="mt-3 text-xs font-medium text-text">Fernando Moraes Lima - Nubank</p>
      <p className="mt-1 font-mono text-[11px] break-all text-faint select-text">{PIX_KEY}</p>
      <div className="mt-4 flex w-full max-w-64 flex-col gap-2">
        <CopyButton text={PIX_KEY} label="Copiar chave" />
        <CopyButton text={PIX_PAYLOAD} label="Pix copia e cola" />
      </div>
    </div>
  )
}
