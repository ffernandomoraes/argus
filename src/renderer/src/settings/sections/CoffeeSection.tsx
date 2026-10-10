import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import QRCode from 'qrcode'
import { useCopied } from '../../lib/useCopied'
import { Button } from '../../ui/Button'
import { PIX_KEY, PIX_PAYLOAD } from './pix'

function CopyButton({ text, label }: { text: string; label: string }) {
  const { copied, copy } = useCopied()
  return (
    <Button size="lg" className="w-full" onClick={() => copy(text)}>
      {copied ? <Check size={12} className="text-done" /> : <Copy size={12} />}
      {copied ? 'Copiado' : label}
    </Button>
  )
}

// Seção "Me pague um café" das configurações: QR Code do Pix, chave e os botões de copiar. O
// cabeçalho da seção (SettingsPage) já traz o título e o convite.
export function CoffeeSection() {
  const [qr, setQr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    QRCode.toString(PIX_PAYLOAD, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' }).then(
      (svg) => alive && setQr(svg),
      (err: unknown) => console.error('[café] QR Code:', err)
    )
    return () => {
      alive = false
    }
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
