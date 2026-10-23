import { Image as ImageIcon } from 'lucide-react'
import { formatImageCount } from '../format'
import { tr } from '../../i18n'

// O seu pedido do trecho que está na tela, preso no topo depois de rolar para cima. Clicar leva
// até ele. Aparece descendo de leve do topo.
export function PinnedPrompt({
  text,
  images,
  visible,
  onClick
}: {
  text: string
  images: number
  visible: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={tr('Ir para a mensagem', 'Go to message')}
      tabIndex={visible ? 0 : -1}
      className={`absolute inset-x-4 top-2 z-10 rounded-lg border border-line bg-surface-2 px-3 py-2 text-left text-[15px] shadow-md transition-[opacity,translate] duration-200 ease-out hover:border-line-strong ${
        visible ? 'opacity-100' : 'pointer-events-none -translate-y-1.5 opacity-0'
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
