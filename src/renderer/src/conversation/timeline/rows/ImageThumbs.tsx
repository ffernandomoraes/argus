import { useEffect, useRef, useState } from 'react'

// Miniaturas das imagens de uma mensagem. Só carregam quando o balão aparece na tela: conversa
// longa com muitos prints não lê todos de uma vez. Antes disso, quadros vazios do mesmo tamanho.
export function ImageThumbs({
  count,
  load,
  onOpen
}: {
  count: number
  // Função fixa por mensagem (ver timeline/imageViews): uma nova refaria o observador.
  load: () => Promise<string[]>
  onOpen: (index: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [urls, setUrls] = useState<string[] | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || urls) return
    let alive = true
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      observer.disconnect()
      load()
        .catch(() => [])
        .then((list) => {
          if (alive) setUrls(list)
        })
        .catch(() => {})
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
