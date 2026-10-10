import { createStore } from '../lib/createStore'
import { useStore } from '../lib/useStore'

// Largura da coluna do chat no modo design, lembrada entre aberturas. Arrasta pela borda direita
// da coluna (SideResizer); dois cliques voltam ao padrão.
const KEY = 'argus.design.sideWidth'
export const DEFAULT_SIDE_WIDTH = 460
const MIN = 300
// Sobra sempre espaço para a tela ao lado.
const max = () => Math.max(MIN, Math.round(window.innerWidth * 0.6))
export const clampSideWidth = (w: number) => Math.min(max(), Math.max(MIN, Math.round(w)))

function saved(): number {
  try {
    const value = Number(localStorage.getItem(KEY))
    return value ? clampSideWidth(value) : DEFAULT_SIDE_WIDTH
  } catch {
    return DEFAULT_SIDE_WIDTH
  }
}

const width = createStore(saved())

export const getSideWidth = width.get

export function setSideWidth(next: number): void {
  width.set(clampSideWidth(next))
  try {
    localStorage.setItem(KEY, String(width.get()))
  } catch {
    // Sem armazenamento: vale até fechar o app.
  }
}

// Com a janela estreitada depois, a coluna não passa do máximo de agora.
export function useSideWidth(): number {
  return useStore(width, (w) => Math.min(w, max()))
}
