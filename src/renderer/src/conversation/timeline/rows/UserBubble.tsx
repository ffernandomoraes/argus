import { memo } from 'react'
import { Crosshair, Image as ImageIcon, MessageSquarePlus } from 'lucide-react'
import type { MessageMark } from '../../types'
import { CopyButton } from '../../CopyButton'
import { formatClock, formatImageCount } from '../../format'
import type { ImageView } from '../imageViews'
import { ImageThumbs } from './ImageThumbs'

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
      {(at || queued) && (
        <span className="self-end px-1 text-[13px] text-faint">
          {queued && 'enviada durante a resposta'}
          {queued && at && ' - '}
          {at && formatClock(at)}
        </span>
      )}
      {/* Copiar fica dentro do balão, numa coluna à direita, no meio da altura do texto. */}
      <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 py-2 pl-3 pr-2 text-[15px]">
        <div className="min-w-0 flex-1">
          {images > 0 && (
            <div className={`flex flex-col gap-1.5 ${text ? 'mb-1.5' : ''}`}>
              {imageView && <ImageThumbs count={images} load={imageView.load} onOpen={imageView.open} />}
              <button
                onClick={() => imageView?.open(0)}
                disabled={!imageView}
                title={imageView ? (images === 1 ? 'Ver imagem' : 'Ver imagens') : undefined}
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
        {text && <CopyButton text={text} label="Copiar prompt" className="shrink-0" />}
      </div>
    </div>
  )
})
