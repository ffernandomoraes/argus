import { Check, Copy } from 'lucide-react'
import { useCopied } from '../lib/useCopied'
import { IconButton } from '../ui/IconButton'

// Copia o texto da mensagem (o markdown original, não o que aparece formatado) e mostra
// um visto por um instante.
export function CopyButton({ text, label, className }: { text: string; label: string; className?: string }) {
  const { copied, copy } = useCopied()
  return (
    <IconButton size="xs" label={copied ? 'Copiado' : label} className={className} onClick={() => copy(text)}>
      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
    </IconButton>
  )
}
