import { createStore, type ReadableStore } from '../lib/createStore'
import { useStore } from '../lib/useStore'

// Largura de uma coluna que se arrasta pela borda (WidthResizer), lembrada entre aberturas. Dois
// cliques na borda voltam ao padrão. Sobra sempre espaço na janela: o máximo é uma fração dela.
export type WidthStore = {
  initial: number
  get: () => number
  set: (next: number) => void
  clamp: (w: number) => number
  max: () => number
  store: ReadableStore<number>
}

export function createWidthStore({ key, initial, min, maxFraction }: { key: string; initial: number; min: number; maxFraction: number }): WidthStore {
  const max = () => Math.max(min, Math.round(window.innerWidth * maxFraction))
  const clamp = (w: number) => Math.min(max(), Math.max(min, Math.round(w)))

  function saved(): number {
    try {
      const value = Number(localStorage.getItem(key))
      return value ? clamp(value) : initial
    } catch {
      return initial
    }
  }

  const width = createStore(saved())

  return {
    initial,
    get: width.get,
    clamp,
    max,
    store: width,
    set(next) {
      width.set(clamp(next))
      try {
        localStorage.setItem(key, String(width.get()))
      } catch {
        // Sem armazenamento: vale até fechar o app.
      }
    }
  }
}

// Hook solto, não método (ver useStore): com a janela estreitada depois, a coluna não passa do
// máximo de agora.
export function useWidth(w: WidthStore): number {
  return useStore(w.store, (value) => Math.min(value, w.max()))
}
