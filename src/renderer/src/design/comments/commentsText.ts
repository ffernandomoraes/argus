import type { PageComment } from './types'

// O pedido para o Claude: o texto que aparece no chat (curto) e o contexto de cada ponto (no hint).
export function commentsText(comments: PageComment[]): string {
  const lines = comments.map((c, i) => `${i + 1}. ${c.note.trim()} (em ${c.name}${c.text ? ` "${c.text.slice(0, 60)}"` : ''})`)
  return `Comentários na página ${comments[0]?.route ?? '/'}:\n${lines.join('\n')}`
}

export function commentsHint(comments: PageComment[]): string {
  const items = comments.map((c, i) =>
    [
      `Comentário ${i + 1}: "${c.note.trim()}"`,
      `- Onde: ${c.name}${c.text ? ` com o texto "${c.text}"` : ''}, na página ${c.route}.`,
      c.path ? `- Caminho na página: ${c.path}` : '',
      c.source ? `- Pistas do código (modo de desenvolvimento do framework): ${c.source}` : '',
      `- HTML como está na página (já renderizado, não é o código-fonte):\n${c.html}`
    ]
      .filter(Boolean)
      .join('\n')
  )
  return `<modo-design>
A pessoa deixou comentários em pontos da página, como no Figma. Cada um é um pedido sobre o elemento clicado e o que está perto dele: ache no código o componente de cada ponto e faça o que o comentário pede ali, sem mexer no resto. Atenda todos e, no fim, diga em uma linha o que fez em cada número.

${items.join('\n\n')}
</modo-design>`
}
