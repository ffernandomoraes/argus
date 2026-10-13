import { createWidthStore } from '../ui/widthStore'

// Largura da coluna do chat no modo design, lembrada entre aberturas. Arrasta pela borda direita
// da coluna (WidthResizer); dois cliques voltam ao padrão. Sobra sempre espaço para a tela ao lado.
export const sideWidth = createWidthStore({ key: 'argus.design.sideWidth', initial: 460, min: 300, maxFraction: 0.6 })
