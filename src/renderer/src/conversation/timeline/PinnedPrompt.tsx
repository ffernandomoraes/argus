import { Image as ImageIcon } from 'lucide-react'
import { formatImageCount } from '../format'

// O seu pedido do trecho que está na tela, preso no topo enquanto se rola para cima. Clicar leva
// até ele; com o mouse em cima, não some.
export function PinnedPrompt({
  text,
  images,
  visible,
  onClick,
  onMouseEnter,
  onMouseLeave
}: {
  text: string
  images: number
  visible: boolean
  onClick: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      title="Ir para a mensagem"
      tabIndex={visible ? 0 : -1}
      className={`absolute inset-x-4 top-2 z-10 rounded-lg border border-line bg-surface-2 px-3 py-2 text-left text-[15px] shadow-md transition-opacity duration-150 hover:border-line-strong ${
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      {text ? (
        <span className="line-clamp-2 whitespace-pre-wrap break-words">{text}</span>
      ) : (
        <span className="flex items-center gap-1.5 text-[13px] text-muted">
          <ImageIcon size={12} className="shrink-0" />
          {formatImageCount(images)}
        </span>
      )}
    </button>
  )
}
