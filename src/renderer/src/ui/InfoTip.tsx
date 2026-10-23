import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'
import { tr } from '../i18n'

const WIDTH = 340
const GAP = 8
const MARGIN = 12

type Position = { left: number; top?: number; bottom?: number }

// Ícone de "mais detalhes" ao lado de um rótulo: passar o mouse (ou focar com o Tab) abre a
// explicação longa. Vai para o body com posição fixa: dentro do modal, a área que rola cortaria a
// dica. Abre para baixo; na metade de baixo da janela, para cima.
export function InfoTip({ text }: { text: string }) {
  const ref = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<Position | null>(null)

  const show = () => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    const left = Math.max(MARGIN, Math.min(r.left - MARGIN, window.innerWidth - WIDTH - MARGIN))
    setPos(r.top > window.innerHeight / 2 ? { left, bottom: window.innerHeight - r.top + GAP } : { left, top: r.bottom + GAP })
  }
  const hide = () => setPos(null)

  // Rolar com o mouse parado em cima deixaria a dica solta, longe do ícone.
  useEffect(() => {
    if (!pos) return
    window.addEventListener('scroll', hide, true)
    return () => window.removeEventListener('scroll', hide, true)
  }, [pos])

  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label={`${tr('Mais detalhes', 'More details')}: ${text}`}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="inline-flex shrink-0 items-center rounded-md p-0.5 text-faint hover:text-muted"
      >
        <Info size={15} />
      </button>
      {pos &&
        createPortal(
          <div
            role="tooltip"
            style={{ ...pos, width: WIDTH }}
            className="pointer-events-none fixed z-[100] rounded-lg border border-line bg-surface/95 px-3 py-2 text-[15px] leading-relaxed text-text shadow-lg backdrop-blur-xl"
          >
            {text}
          </div>,
          document.body
        )}
    </>
  )
}
