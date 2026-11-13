import { Check, Copy } from 'lucide-react'
import { useCopied } from '../lib/useCopied'
import { IconButton } from '../ui/IconButton'
import { tr } from '../i18n'

// Copia o texto da mensagem (o markdown original, não o que aparece formatado) e mostra
// um visto por um instante.
export function CopyButton({ text, label, className }: { text: string; label: string; className?: string }) {
  const { copied, copy } = useCopied()
  return (
    <IconButton size="xs" label={copied ? tr('Copiado', 'Copied') : label} className={className} onClick={() => copy(text)}>
      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
    </IconButton>
  )
}
