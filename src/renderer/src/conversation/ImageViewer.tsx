import { useEffect, useEffectEvent, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react'
import { IconButton } from '../ui/IconButton'
import { useEscape } from '../useEscape'

// Imagens enviadas numa mensagem, grandes, sobre o app. ESC ou clique fora fecha; ← → trocam.
// Vai direto para o body: o chat tem zoom (⌘+ / ⌘-) e o modal não deve encolher junto.
export function ImageViewer({
  load,
  start = 0,
  onClose
}: {
  load: () => Promise<string[]>
  // Imagem que abre primeiro (a miniatura clicada).
  start?: number
  onClose: () => void
}) {
  const [urls, setUrls] = useState<string[] | null>(null)
  const [index, setIndex] = useState(start)
  useEscape(onClose)

  useEffect(() => {
    let alive = true
    load()
      .catch(() => [])
      .then((list) => {
        if (alive) setUrls(list)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [load])

  const count = urls?.length ?? 0
  const go = (step: number) => setIndex((i) => (i + step + count) % count)

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') go(-1)
    else if (e.key === 'ArrowRight') go(1)
    else return
    e.preventDefault()
    e.stopPropagation()
  })
  useEffect(() => {
    if (count < 2) return
    const listener = (e: KeyboardEvent) => onKey(e)
    window.addEventListener('keydown', listener, true)
    return () => window.removeEventListener('keydown', listener, true)
  }, [count])

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/75 p-8" onMouseDown={onClose}>
      <IconButton label="Fechar" variant="floating" size="lg" onClick={onClose} className="absolute right-4 top-4">
        <X size={15} />
      </IconButton>
      {urls === null ? (
        <Loader2 size={20} className="animate-spin text-muted" />
      ) : count === 0 ? (
        <p className="rounded-lg border border-line bg-surface px-4 py-3 text-xs text-muted">
          Não deu para carregar a imagem.
        </p>
      ) : (
        <>
          <div className="flex min-h-0 w-full flex-1 items-center justify-center">
            <img
              src={urls[index]}
              alt={`Imagem ${index + 1} de ${count}`}
              onMouseDown={(e) => e.stopPropagation()}
              className="max-h-full max-w-full rounded-lg object-contain shadow-2xl shadow-black/60"
            />
          </div>
          {count > 1 && (
            <div
              onMouseDown={(e) => e.stopPropagation()}
              className="flex items-center gap-2 rounded-xl border border-line bg-surface px-1 py-1 text-xs text-muted"
            >
              <IconButton label="Imagem anterior" size="lg" onClick={() => go(-1)}>
                <ChevronLeft size={15} />
              </IconButton>
              <span className="tabular-nums">
                {index + 1} de {count}
              </span>
              <IconButton label="Próxima imagem" size="lg" onClick={() => go(1)}>
                <ChevronRight size={15} />
              </IconButton>
            </div>
          )}
        </>
      )}
    </div>,
    document.body
  )
}
