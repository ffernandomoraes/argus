import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'

// Copia o texto da mensagem (o markdown original, não o que aparece formatado) e mostra
// um visto por um instante.
export function CopyButton({ text, label, className = '' }: { text: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timer)
  }, [copied])

  return (
    <button
      type="button"
      aria-label={copied ? 'Copiado' : label}
      title={copied ? 'Copiado' : label}
      onClick={() => void navigator.clipboard.writeText(text).then(() => setCopied(true))}
      className={`inline-flex size-5 items-center justify-center rounded text-faint hover:bg-surface-2 hover:text-text ${className}`}
    >
      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
    </button>
  )
}
