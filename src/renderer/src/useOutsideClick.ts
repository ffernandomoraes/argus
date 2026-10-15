import { useEffect, useEffectEvent, type RefObject } from 'react'

type ElementRef = RefObject<HTMLElement | null>

// Botões cujo menu está aberto (ui/useAnchoredMenu). O pointerdown num deles não conta como clique
// fora para nenhum menu: quem fecha é o clique do próprio botão, que alterna. Sem isso, o
// pointerdown (na captura) fechava o menu e o click do botão o abria de novo.
const openAnchors = new Set<ElementRef>()

export function holdOpenAnchor(ref: ElementRef): () => void {
  openAnchors.add(ref)
  return () => {
    openAnchors.delete(ref)
  }
}

const contains = (ref: ElementRef, target: Node) => !!ref.current?.contains(target)

// Menu aberto fecha com um clique em qualquer lugar fora dele, como no macOS. O ouvinte é na fase
// de captura, para valer mesmo onde o clique para no caminho (canvas, drawer). Clique dentro de um
// iframe ou webview (a tela do modo design, o navegador) não chega à janela: ela só perde o foco,
// e isso também fecha. Ouve o pointerdown, não o mousedown: quem arrasta (o cabeçalho do drawer, o
// canvas) cancela o pointerdown, e aí o navegador nem dispara o mousedown. `ignore`: outros
// elementos onde o clique também não conta como fora.
export function useOutsideClick(
  ref: ElementRef,
  onOutside: () => void,
  enabled = true,
  ignore?: readonly ElementRef[]
): void {
  const onDown = useEffectEvent((target: Node) => {
    if (contains(ref, target) || ignore?.some((r) => contains(r, target))) return
    for (const anchor of openAnchors) if (contains(anchor, target)) return
    onOutside()
  })
  const onBlur = useEffectEvent(() => onOutside())

  useEffect(() => {
    if (!enabled) return
    const down = (e: PointerEvent) => onDown(e.target as Node)
    const blur = () => onBlur()
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('pointerdown', down, true)
      window.removeEventListener('blur', blur)
    }
  }, [enabled])
}
