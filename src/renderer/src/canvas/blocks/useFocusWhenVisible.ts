import { useEffect, type RefObject } from 'react'

// Bloco recém-criado fica invisível até o React Flow medir o tamanho dele, e o navegador não
// foca elemento invisível (o autoFocus falha). Tenta a cada quadro até pegar, por até 30 quadros.
// `after` roda logo depois de cada tentativa (ex.: pôr o cursor no fim do texto).
// Fora do hook de propósito: o contador de tentativas preso no laço impede o React Compiler de
// otimizar o componente.
function focusWhenVisible(get: () => HTMLElement | null, after?: (el: HTMLElement) => void): () => void {
  let frame = 0
  let tries = 0
  const attempt = () => {
    const el = get()
    if (!el || document.activeElement === el) return
    el.focus()
    after?.(el)
    if (document.activeElement !== el && ++tries < 30) frame = requestAnimationFrame(attempt)
  }
  attempt()
  return () => cancelAnimationFrame(frame)
}

// Foca o campo ao montar, esperando ele aparecer na tela. `after` tem que ser fixo (definido
// fora do componente).
export function useFocusWhenVisible<T extends HTMLElement>(ref: RefObject<T | null>, after?: (el: T) => void): void {
  useEffect(() => focusWhenVisible(() => ref.current, after as ((el: HTMLElement) => void) | undefined), [ref, after])
}
