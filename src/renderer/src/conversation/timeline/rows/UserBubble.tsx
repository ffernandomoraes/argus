import { memo } from 'react'
import { Crosshair, Image as ImageIcon, MessageSquarePlus } from 'lucide-react'
import type { MessageMark } from '../../types'
import { CopyButton } from '../../CopyButton'
import { formatClock, formatImageCount } from '../../format'
import type { ImageView } from '../imageViews'
import { ImageThumbs } from './ImageThumbs'
import { tr } from '../../../i18n'

// Mensagem sua. queued: enviada enquanto o Claude trabalhava.
// imageView: lê as imagens enviadas (miniaturas) e abre o preview grande numa delas.
export const UserBubble = memo(function UserBubble({
  text,
  at,
  queued,
  images = 0,
  imageView,
  marks
}: {
  text: string
  at?: string
  queued?: boolean
  images?: number
  imageView?: ImageView
  // O que foi junto no modo design (parte selecionada, comentários): uma linha discreta embaixo.
  marks?: MessageMark[]
}) {
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
          {text && <CopyButton text={text} label={tr('Copiar prompt', 'Copy prompt')} />}
        </div>
      )}
    </div>
  )
})
