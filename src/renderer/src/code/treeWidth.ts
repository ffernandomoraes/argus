import { createWidthStore } from '../ui/widthStore'

// Largura da árvore do painel de código, lembrada entre aberturas. Arrasta pela borda direita
// (WidthResizer) para ver nomes compridos; dois cliques voltam ao padrão.
export const treeWidth = createWidthStore({ key: 'argus.code.treeWidth', initial: 280, min: 200, maxFraction: 0.5 })
