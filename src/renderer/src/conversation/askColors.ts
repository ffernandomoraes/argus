import type { CSSProperties } from 'react'

// Perguntas e permissões no chat, na cor do grupo (tokens ask em index.css). O texto do botão
// cheio é branco nas cores escuras e quase preto nas claras (âmbar, verde, ciano), onde o branco
// some. Espera a cor em #rrggbb, como a paleta dos grupos.
export function askColors(tint: string): CSSProperties {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(tint.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return { '--color-ask': tint, '--color-ask-text': luminance > 0.3 ? '#1c1c1c' : '#ffffff' } as CSSProperties
}
