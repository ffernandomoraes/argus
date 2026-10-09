import { useEffect, useRef } from 'react'

// ESC fecha uma camada por vez: a que abriu por último (o menu dentro do drawer antes do drawer).
// Cada camada aberta entra numa pilha, e um só ouvinte na janela chama a do topo.
const stack: { current: () => void }[] = []

window.addEventListener('keydown', (e) => {
  // Campo que já usou o ESC (fechar a lista de comandos, cancelar a renomeação) chama preventDefault.
  if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing) return
  // No terminal, o ESC é do programa que roda nele (interrompe o Claude, sai do modo de inserção).
  if ((e.target as Element | null)?.closest?.('.xterm')) return
  const top = stack[stack.length - 1]
  if (!top) return
  e.preventDefault()
  top.current()
})

// Esc que aconteceu numa página embutida (a tela do modo design), onde o teclado não chega à janela.
export function pressEscape(): void {
  stack[stack.length - 1]?.current()
}

// `enabled` falso tira a camada da pilha (menu fechado). A posição na pilha é a de quando abriu,
// mesmo que `onEscape` mude depois.
export function useEscape(onEscape: () => void, enabled = true): void {
  const handler = useRef(onEscape)
  handler.current = onEscape
  useEffect(() => {
    if (!enabled) return
    stack.push(handler)
    return () => {
      stack.splice(stack.lastIndexOf(handler), 1)
    }
  }, [enabled])
}
