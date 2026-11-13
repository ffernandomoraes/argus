// Para quem vai uma tecla, pelo elemento onde ela caiu (o foco).

// Campo de texto, editor de código (CodeMirror), terminal (xterm) ou qualquer coisa editável:
// a tecla é de quem está digitando, e atalho do canvas não age.
const EDITABLE = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), .xterm, .cm-editor'

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return (target as HTMLElement).isContentEditable || target.closest(EDITABLE) !== null
}

// Foco no canvas: em nada (body) ou dentro do React Flow, fora de campo de texto. Num modal, num
// drawer ou num campo, a tecla é de quem está lá.
export function isCanvasTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element) || isEditableTarget(target)) return false
  return target === document.body || target.closest('.react-flow') !== null
}
