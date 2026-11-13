import { FileText } from 'lucide-react'

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// Arquivo anexado que não é imagem: ícone, nome e tamanho. O mesmo cartão na caixa de escrever,
// antes de enviar, e no balão da mensagem enviada (title: o caminho completo, ali).
export function FileCard({ name, size, title, className = '' }: { name: string; size?: number; title?: string; className?: string }) {
  return (
    <div title={title ?? name} className={`flex h-14 max-w-48 items-center gap-2 rounded-md border border-line px-2.5 ${className}`}>
      <FileText size={16} className="shrink-0 text-muted" />
      <div className="min-w-0">
        <div className="truncate text-xs text-text">{name}</div>
        {size !== undefined && <div className="text-[11px] text-faint">{formatSize(size)}</div>}
      </div>
    </div>
  )
}
