import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react'
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
      .then((list) => alive && setUrls(list))
    return () => {
      alive = false
    }
  }, [load])

  const count = urls?.length ?? 0
  const go = (step: number) => setIndex((i) => (i + step + count) % count)

  useEffect(() => {
    if (count < 2) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
      else return
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [count]) // eslint-disable-line react-hooks/exhaustive-deps

  const navButton = 'flex size-8 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-text'

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/75 p-8" onMouseDown={onClose}>
      <button
        aria-label="Fechar"
        onClick={onClose}
        className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full border border-line bg-surface text-muted hover:text-text"
      >
        <X size={15} />
      </button>
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
              className="flex items-center gap-2 rounded-full border border-line bg-surface px-1 py-1 text-xs text-muted"
            >
              <button aria-label="Imagem anterior" onClick={() => go(-1)} className={navButton}>
                <ChevronLeft size={15} />
              </button>
              <span className="tabular-nums">
                {index + 1} de {count}
              </span>
              <button aria-label="Próxima imagem" onClick={() => go(1)} className={navButton}>
                <ChevronRight size={15} />
              </button>
            </div>
          )}
        </>
      )}
    </div>,
    document.body
  )
}

// Miniaturas das imagens de uma mensagem. Só carregam quando o balão aparece na tela: conversa
// longa com muitos prints não lê todos de uma vez. Antes disso, quadros vazios do mesmo tamanho.
export function ImageThumbs({
  count,
  load,
  onOpen
}: {
  count: number
  load: () => Promise<string[]>
  onOpen: (index: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [urls, setUrls] = useState<string[] | null>(null)

  useEffect(() => {
    const el = ref.current
    // Já carregou: a função nova que chega a cada renderização não lê de novo.
    if (!el || urls) return
    let alive = true
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      observer.disconnect()
      load()
        .catch(() => [])
        .then((list) => alive && setUrls(list))
    })
    observer.observe(el)
    return () => {
      alive = false
      observer.disconnect()
    }
  }, [load, urls])

  // Imagem que não deu para ler (formato desconhecido) não vira quadro vazio para sempre.
  if (urls && urls.length === 0) return null
  const slots = urls ?? Array.from({ length: count }, () => null)

  return (
    <div ref={ref} className="flex flex-wrap gap-1.5">
      {slots.map((url, i) =>
        url ? (
          <button
            key={i}
            onClick={() => onOpen(i)}
            title="Ver imagem"
            className="overflow-hidden rounded-md border border-line hover:border-line-strong"
          >
            <img src={url} alt={`Imagem ${i + 1}`} className="size-14 object-cover" />
          </button>
        ) : (
          <div key={i} className="size-14 rounded-md border border-line bg-surface" />
        )
      )}
    </div>
  )
}
