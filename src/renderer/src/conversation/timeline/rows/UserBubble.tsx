import { memo, useState, type KeyboardEvent } from 'react'
import { Crosshair, Image as ImageIcon, MessageSquarePlus, Pencil } from 'lucide-react'
import { fileName, type AttachedFile } from '../../../../../shared/attachedFiles'
import type { MessageMark } from '../../types'
import { CopyButton } from '../../CopyButton'
import { FileCard } from '../../FileCard'
import { Button } from '../../../ui/Button'
import { IconButton } from '../../../ui/IconButton'
import { formatClock, formatImageCount } from '../../format'
import type { ImageView } from '../imageViews'
import { ImageThumbs } from './ImageThumbs'
import { tr } from '../../../i18n'

// Mensagem sua. queued: enviada enquanto o Claude trabalhava.
// imageView: lê as imagens enviadas (miniaturas) e abre o preview grande numa delas.
// files: os outros anexos, no mesmo cartão da caixa de escrever (o agente recebe o caminho).
// onEdit: o lápis troca o texto por um campo; enviar manda a versão nova como mensagem nova, no fim
// da conversa (a original fica onde está). Só em mensagem de texto puro: imagens, anexos e o que foi
// junto no modo design não iriam no reenvio.
export const UserBubble = memo(function UserBubble({
  text,
  at,
  queued,
  images = 0,
  imageView,
  marks,
  files,
  onEdit
}: {
  text: string
  at?: string
  queued?: boolean
  images?: number
  imageView?: ImageView
  // O que foi junto no modo design (parte selecionada, comentários): uma linha discreta embaixo.
  marks?: MessageMark[]
  files?: AttachedFile[]
  onEdit?: (text: string) => void
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const editable = !!onEdit && !!text && images === 0 && !files?.length && !marks
  if (editing !== null && onEdit) {
    const send = () => {
      const edited = editing.trim()
      if (!edited) return
      setEditing(null)
      onEdit(edited)
    }
    return <EditBubble value={editing} onChange={setEditing} onCancel={() => setEditing(null)} onSend={send} />
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-[15px]">
        <div className="min-w-0">
          {images > 0 && (
            <div className={`flex flex-col gap-1.5 ${text ? 'mb-1.5' : ''}`}>
              {imageView && <ImageThumbs count={images} load={imageView.load} onOpen={imageView.open} />}
              <button
                onClick={() => imageView?.open(0)}
                disabled={!imageView}
                title={imageView ? (images === 1 ? tr('Ver imagem', 'View image') : tr('Ver imagens', 'View images')) : undefined}
                className="flex items-center gap-1.5 self-start rounded-md text-[13px] text-muted enabled:hover:text-text enabled:hover:underline"
              >
                <ImageIcon size={12} className="shrink-0" />
                {formatImageCount(images)}
              </button>
            </div>
          )}
          {files && files.length > 0 && (
            <div className={`flex flex-wrap gap-2 ${text ? 'mb-1.5' : ''}`}>
              {files.map((f, i) => (
                <FileCard key={i} name={fileName(f.path)} size={f.size} title={f.path} className="bg-surface" />
              ))}
            </div>
          )}
          {text && <span className="whitespace-pre-wrap break-words">{text}</span>}
          {marks && (
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-faint">
              {marks.map((m, i) => (
                <span key={i} className="flex min-w-0 items-center gap-1">
                  {m.kind === 'comentarios' ? <MessageSquarePlus size={11} className="shrink-0" /> : <Crosshair size={11} className="shrink-0" />}
                  <span className="truncate">{m.text}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Hora e copiar ficam embaixo do balão, à direita, para o texto usar a largura toda. */}
      {(at || queued || text) && (
        <div className="flex items-center justify-end gap-1 px-1 text-[13px] text-faint">
          {(at || queued) && (
            <span>
              {queued && tr('enviada durante a resposta', 'sent during the response')}
              {queued && at && ' - '}
              {at && formatClock(at)}
            </span>
          )}
          {editable && (
            <IconButton size="xs" label={tr('Editar e reenviar', 'Edit and resend')} onClick={() => setEditing(text)}>
              <Pencil size={12} />
            </IconButton>
          )}
          {text && <CopyButton text={text} label={tr('Copiar prompt', 'Copy prompt')} />}
        </div>
      )}
    </div>
  )
})

// O balão virando campo: Enter envia e Shift+Enter quebra a linha (como na caixa de escrever), Esc
// desiste. As teclas param aqui: a rolagem da conversa não as toma por navegação.
function EditBubble({ value, onChange, onCancel, onSend }: { value: string; onChange: (v: string) => void; onCancel: () => void; onSend: () => void }) {
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation()
    if (e.key === 'Escape') onCancel()
    else if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      onSend()
    }
  }
  return (
    <div className="flex flex-col gap-1.5">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        // Cursor no fim do texto, sem rolar a conversa até o campo.
        ref={(el) => {
          if (!el || el === document.activeElement) return
          el.focus({ preventScroll: true })
          el.setSelectionRange(el.value.length, el.value.length)
        }}
        aria-label={tr('Editar mensagem', 'Edit message')}
        className="block max-h-[calc(12lh+1rem)] w-full resize-none rounded-lg border border-accent bg-surface-2 px-3 py-2 text-[15px] outline-none [field-sizing:content]"
      />
      <div className="flex justify-end gap-1.5">
        <Button variant="secondary" size="sm" onClick={onCancel}>
          {tr('Cancelar', 'Cancel')}
        </Button>
        <Button variant="primary" size="sm" onClick={onSend} disabled={!value.trim()}>
          {tr('Enviar', 'Send')}
        </Button>
      </div>
    </div>
  )
}
