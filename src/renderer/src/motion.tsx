import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

// Efeito padrão de aparecer e sumir: "fade through". Some rápido encolhendo de leve; aparece
// com fade, subindo uns pixels e assentando no final. Menus usam a versão curta: abrem o tempo
// todo e não podem atrasar o uso.
export const MOTION = {
  panel: {
    in: { duration: 280, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
    out: { duration: 130, easing: 'cubic-bezier(0.4, 0, 1, 1)' },
    from: 'scale(0.985) translateY(8px)',
    to: 'scale(0.985)'
  },
  menu: {
    in: { duration: 120, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
    out: { duration: 80, easing: 'cubic-bezier(0.4, 0, 1, 1)' },
    from: 'scale(0.97)',
    to: 'scale(0.97)'
  }
}

export type MotionKind = 'panel' | 'modal' | 'menu'

export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches

// Painel e menu: o próprio elemento faz fade e escala. Modal: o fundo escuro só faz fade, e a
// caixa (filho com role de diálogo, ou marcado com data-motion-card) escala, senão o fundo
// encolheria e mostraria as bordas. Sem caixa (visualizador de imagem), só o fade.
function animate(el: Element, kind: MotionKind, direction: 'in' | 'out'): Animation[] {
  const m = kind === 'menu' ? MOTION.menu : MOTION.panel
  const timing = { ...m[direction], fill: direction === 'out' ? ('forwards' as const) : ('none' as const) }
  const hidden = direction === 'in' ? m.from : m.to
  const fade = direction === 'in' ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }]
  const move = direction === 'in' ? [{ transform: hidden }, { transform: 'none' }] : [{ transform: 'none' }, { transform: hidden }]
  if (kind !== 'modal') return [el.animate(fade.map((f, i) => ({ ...f, ...move[i] })), timing)]
  const card = el.querySelector(':scope > [role=dialog], :scope > [role=alertdialog], :scope > [data-motion-card]')
  return [el.animate(fade, timing), ...(card ? [card.animate(move, timing)] : [])]
}

// Saindo, o conteúdo não responde mais: nem ao mouse nem ao teclado. Sem o `inert`, o campo
// focado seguia recebendo teclas durante o fade (Enter duas vezes adicionava a pasta duas vezes).
// Devolve como desfazer, para quando ele volta antes de terminar de sair.
function freeze(el: HTMLElement): () => void {
  const inert = el.inert
  el.style.pointerEvents = 'none'
  el.inert = true
  return () => {
    el.style.pointerEvents = ''
    el.inert = inert
  }
}

// Envolve um elemento que entra e sai da tela: `{aberto && <Painel />}` vira
// `<Presence>{aberto && <Painel />}</Presence>`. Ao sumir, o último conteúdo fica montado até o
// fade de saída terminar. Não cria elemento em volta (os painéis medem o pai para se posicionar):
// um marcador escondido logo antes aponta qual é o elemento animado.
export function Presence({ children, kind = 'panel' }: { children: ReactNode; kind?: MotionKind }) {
  const present = !!children
  // Último conteúdo mostrado: é ele que fica na tela durante a saída.
  const [last, setLast] = useState<ReactNode>(children)
  if (present && children !== last) setLast(children)

  // Decidido durante o render: no mesmo render em que o conteúdo some, ele já fica montado. Com
  // Reduzir movimento, não há saída: some na hora.
  const [prevPresent, setPrevPresent] = useState(present)
  const [leaving, setLeaving] = useState(false)
  if (present !== prevPresent) {
    setPrevPresent(present)
    setLeaving(!present && !reduced())
  }

  const marker = useRef<HTMLSpanElement>(null)
  const running = useRef<Animation[]>([])
  useLayoutEffect(() => {
    // Nada na tela: montou fechado (o irmão seguinte ao marcador é outro elemento, que não pode
    // receber a saída; foi o que apagou o botão de limites, logo depois do menu dele) ou a saída
    // já terminou.
    if (!present && !leaving) return
    const el = marker.current?.nextElementSibling
    running.current.forEach((a) => a.cancel())
    running.current = []
    if (present) {
      if (el && !reduced()) running.current = animate(el, kind, 'in')
      return
    }
    // Sem elemento para animar, a saída termina logo.
    const unfreeze = el instanceof HTMLElement ? freeze(el) : null
    const anims = el ? animate(el, kind, 'out') : []
    running.current = anims
    let alive = true
    Promise.all(anims.map((a) => a.finished))
      .then(() => alive && setLeaving(false))
      .catch(() => {})
    return () => {
      alive = false
      unfreeze?.()
    }
  }, [present, leaving, kind])

  return (
    <>
      <span ref={marker} hidden />
      {present ? children : leaving ? last : null}
    </>
  )
}
