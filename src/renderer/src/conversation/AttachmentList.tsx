import { useMemo, useState } from 'react'
import { AudioLines, X } from 'lucide-react'
import { isAudioFile } from '../../../shared/transcription'
import { IconButton } from '../ui/IconButton'
import { usePreference } from '../settings/preferences'
import { AudioStatus } from './audio/AudioStatus'
import { FileCard, formatSize } from './FileCard'
import { ImageViewer } from './ImageViewer'
import type { Attachment } from './useAttachments'
import { tr } from '../i18n'

// Anexos da mensagem que está sendo escrita, acima do texto: miniatura das imagens, nome e tamanho
// dos outros arquivos (no áudio, a transcrição). O X aparece ao passar o mouse. Clicar na miniatura
// abre a imagem grande, antes de enviar.
export function AttachmentList({ items, onRemove }: { items: Attachment[]; onRemove: (id: string) => void }) {
  const transcribe = usePreference('audioTranscription')
  // Índice, entre as imagens anexadas, da que está aberta.
  const [viewing, setViewing] = useState<number | null>(null)
  const urls = useMemo(() => items.flatMap((a) => (a.previewUrl ? [a.previewUrl] : [])), [items])
  // Mesma função enquanto as imagens não mudam: o visualizador recarrega quando ela muda.
  const load = useMemo(() => () => Promise.resolve(urls), [urls])
  if (items.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 px-3 pt-3">
      {items.map((a) => (
        <div key={a.id} className="group relative">
          {a.previewUrl ? (
            <button
              type="button"
              title={a.file.name}
              aria-label={tr(`Ver ${a.file.name}`, `View ${a.file.name}`)}
              onClick={() => setViewing(urls.indexOf(a.previewUrl!))}
              className="block cursor-zoom-in rounded-md"
            >
              <img src={a.previewUrl} alt={a.file.name} className="size-14 rounded-md border border-line object-cover" />
            </button>
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
            <FileCard name={a.file.name} size={a.file.size} className="bg-surface-2" />
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
      {viewing !== null && <ImageViewer load={load} start={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}
