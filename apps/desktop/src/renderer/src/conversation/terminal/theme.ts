// Cores e fonte do terminal (xterm).
export const TERMINAL_THEME = {
  background: '#0c0c0d',
  foreground: '#e7e7ea',
  cursor: '#e7e7ea',
  selectionBackground: '#3a3a42',
  // O xterm 6 desenha a própria barra de rolagem; cores iguais às do resto do app.
  scrollbarSliderBackground: 'rgba(124, 124, 135, 0.35)',
  scrollbarSliderHoverBackground: 'rgba(124, 124, 135, 0.6)',
  scrollbarSliderActiveBackground: 'rgba(168, 168, 178, 0.7)'
}

export const TERMINAL_FONT = "'JetBrains Mono', 'SF Mono', Menlo, 'Cascadia Mono', Consolas, monospace"

const FONT_SIZE = 12

// Escala do drawer (⌘+ e ⌘- no modo foco): o xterm desenha o próprio texto, então ela vira
// tamanho de fonte.
export const fontSizeFor = (scale: number) => Math.round(FONT_SIZE * scale)
