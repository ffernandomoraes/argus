import { useEffect, useEffectEvent, useState, type RefObject } from 'react'
import { focusableIn, focusQuietly } from './focusable'

type Root = RefObject<HTMLElement | null>

// Camadas com o foco preso, na ordem em que abriram: só a de cima segura o Tab (a confirmação
// por cima das configurações). Um ouvinte só na janela, enquanto houver alguma.
const traps: Root[] = []

function onKeyDown(e: KeyboardEvent): void {
  if (e.key !== 'Tab' || e.defaultPrevented) return
  const root = traps.at(-1)?.current
  if (!root) return
  const items = focusableIn(root)
  const first = items[0]
  const last = items.at(-1)
  const active = document.activeElement
  if (!first || !last) {
    e.preventDefault()
    focusQuietly(root)
  } else if (!root.contains(active)) {
    e.preventDefault()
    focusQuietly(e.shiftKey ? last : first)
  } else if (e.shiftKey && (active === first || active === root)) {
    e.preventDefault()
    focusQuietly(last)
  } else if (!e.shiftKey && active === last) {
    e.preventDefault()
    focusQuietly(first)
  }
}

// Campo onde se digita: input de texto (não caixa de seleção, botão, cor), textarea, editável.
const NOT_TEXT = ['checkbox', 'radio', 'button', 'submit', 'reset', 'color', 'file', 'range']
const TEXT_FIELD = [
  `input${NOT_TEXT.map((t) => `:not([type="${t}"])`).join('')}`,
  'textarea',
  '[contenteditable]:not([contenteditable="false"])'
].join(', ')

export type FocusTrapOptions = {
  // Quem recebe o foco ao abrir. Sem ele, o primeiro campo de texto; sem campo, a própria caixa
  // (que precisa de tabIndex={-1}): o primeiro focável podia ser o X, e Enter ou espaço fechariam.
  initialFocus?: RefObject<HTMLElement | null>
  // Devolver o foco a quem tinha antes, ao fechar. Padrão: sim.
  restoreFocus?: boolean
}

// Foco de uma camada que cobre a tela (modal): entra nela ao abrir, o Tab e o Shift+Tab dão a
// volta só dentro dela e, ao fechar, o foco volta para onde estava (o botão que abriu).
export function useFocusTrap(ref: Root, { initialFocus, restoreFocus = true }: FocusTrapOptions = {}): void {
  // Lido no primeiro render, antes de algum autoFocus de dentro levar o foco.
  const [previous] = useState(() => (document.activeElement instanceof HTMLElement ? document.activeElement : null))

  const enter = useEffectEvent((root: HTMLElement) => {
    // Um autoFocus de dentro (o Cancelar da confirmação) já levou o foco: fica com ele.
    if (root.contains(document.activeElement)) return
    const field = focusableIn(root).find((el) => el.matches(TEXT_FIELD))
    focusQuietly(initialFocus?.current ?? field ?? root)
  })
  const leave = useEffectEvent((root: HTMLElement) => {
    // Só devolve se ninguém de fora pegou o foco nesse meio-tempo (ex.: o drawer que o botão abriu).
    const active = document.activeElement
    const free = !active || active === document.body || root.contains(active)
    if (restoreFocus && free && previous?.isConnected) focusQuietly(previous)
  })

  useEffect(() => {
    const root = ref.current
    if (!root) return
    if (traps.length === 0) window.addEventListener('keydown', onKeyDown)
    traps.push(ref)
    enter(root)
    return () => {
      traps.splice(traps.lastIndexOf(ref), 1)
      if (traps.length === 0) window.removeEventListener('keydown', onKeyDown)
      leave(root)
    }
  }, [ref])
}
