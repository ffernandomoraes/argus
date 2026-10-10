import { useEffect, useEffectEvent } from 'react'

// ESC fecha uma camada por vez: a que abriu por último (o menu dentro do drawer antes do drawer).
// Cada camada aberta entra numa pilha, e um só ouvinte na janela chama a do topo.
const stack: (() => void)[] = []

window.addEventListener('keydown', (e) => {
  // Campo que já usou o ESC (fechar a lista de comandos, cancelar a renomeação) chama preventDefault.
  if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing) return
  // No terminal, o ESC é do programa que roda nele (interrompe o Claude, sai do modo de inserção).
  if ((e.target as Element | null)?.closest?.('.xterm')) return
  const top = stack[stack.length - 1]
  if (!top) return
  e.preventDefault()
  top()
})

// Esc que aconteceu numa página embutida (a tela do modo design), onde o teclado não chega à janela.
export function pressEscape(): void {
  stack[stack.length - 1]?.()
}

// `enabled` falso tira a camada da pilha (menu fechado). A posição na pilha é a de quando abriu,
// mesmo que `onEscape` mude depois.
export function useEscape(onEscape: () => void, enabled = true): void {
  // Sempre a função do último render, sem reentrar na pilha quando ela muda.
  const run = useEffectEvent(onEscape)
  useEffect(() => {
    if (!enabled) return
    const layer = () => run()
    stack.push(layer)
    return () => {
      const i = stack.lastIndexOf(layer)
      if (i >= 0) stack.splice(i, 1)
    }
  }, [enabled])
}
