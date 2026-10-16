import { AudioLines, FileText, X } from 'lucide-react'
import { isAudioFile } from '../../../shared/transcription'
import { IconButton } from '../ui/IconButton'
import { usePreference } from '../settings/preferences'
import { AudioStatus } from './audio/AudioStatus'
import type { Attachment } from './useAttachments'
import { tr } from '../i18n'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// Anexos da mensagem que está sendo escrita, acima do texto: miniatura das imagens, nome e tamanho
// dos outros arquivos (no áudio, a transcrição). O X aparece ao passar o mouse.
export function AttachmentList({ items, onRemove }: { items: Attachment[]; onRemove: (id: string) => void }) {
  const transcribe = usePreference('audioTranscription')
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
          ) : transcribe && isAudioFile(a.file.name, a.file.type) ? (
            // Áudio: mais largo, com a transcrição embaixo do nome (ver AudioStatus).
            <div className="flex h-14 max-w-80 items-center gap-2 rounded-md border border-line bg-surface-2 px-2.5">
              <AudioLines size={16} className="shrink-0 text-muted" />
              <div className="min-w-0">
                <div title={a.file.name} className="truncate text-xs text-text">
                  {a.file.name} <span className="text-[11px] text-faint">- {formatSize(a.file.size)}</span>
                </div>
                <AudioStatus file={a.file} />
              </div>
            </div>
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
          <IconButton
            label={tr(`Remover ${a.file.name}`, `Remove ${a.file.name}`)}
            variant="floating"
            size="xs"
            onClick={() => onRemove(a.id)}
            className="absolute -right-1.5 -top-1.5 opacity-0 group-hover:opacity-100"
          >
            <X size={11} />
          </IconButton>
        </div>
      ))}
    </div>
  )
}
