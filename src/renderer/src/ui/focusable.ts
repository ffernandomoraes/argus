const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  'iframe',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]'
].join(',')

// Elementos de `root` que o Tab visita, na ordem do documento: fora os desligados, os com
// tabindex negativo, os escondidos (sem caixa na tela) e os dentro de área `inert`.
export function focusableIn(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => el.tabIndex >= 0 && !el.closest('[inert]') && el.getClientRects().length > 0
  )
}

// Foca sem rolar nada: no canvas, o navegador rolaria o painel para mostrar o elemento.
export function focusQuietly(el: HTMLElement | null | undefined): void {
  el?.focus({ preventScroll: true })
}
