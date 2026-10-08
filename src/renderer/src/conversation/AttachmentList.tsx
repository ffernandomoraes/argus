import { FileText, X } from 'lucide-react'
import type { Attachment } from './useAttachments'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function AttachmentList({ items, onRemove }: { items: Attachment[]; onRemove: (id: string) => void }) {
  if (items.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 px-3 pt-3">
      {items.map((a) => (
        <div key={a.id} className="group relative">
          {a.previewUrl ? (
            <img
              src={a.previewUrl}
              alt={a.file.name}
              title={a.file.name}
              className="size-14 rounded-md border border-line object-cover"
            />
          ) : (
            <div
              title={a.file.name}
              className="flex h-14 max-w-48 items-center gap-2 rounded-md border border-line bg-surface-2 px-2.5"
            >
              <FileText size={16} className="shrink-0 text-muted" />
              <div className="min-w-0">
                <div className="truncate text-xs text-text">{a.file.name}</div>
                <div className="text-[11px] text-faint">{formatSize(a.file.size)}</div>
              </div>
            </div>
          )}
          <button
            aria-label={`Remover ${a.file.name}`}
            onClick={() => onRemove(a.id)}
            className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-md border border-line bg-surface text-muted opacity-0 shadow hover:text-text group-hover:opacity-100"
          >
            <X size={11} />
          </button>
        </div>
      ))}
    </div>
  )
}
