// Comentário na página do protótipo: o ponto clicado (preso a um elemento da página, ver COMMENT
// em designPicker/scripts/comment.ts), o que se sabe desse elemento e o pedido escrito no balão.
// Vários se juntam e vão num pedido só; enviados, somem.
export type PageComment = {
  id: number
  note: string
  // A página em que foi feito.
  route: string
  name: string
  text: string
  html: string
  path: string
  source: string
  // Ponto do clique, em pixels da página; a posição atual vem de CommentPositions.
  x: number
  y: number
}

// O que a página manda ao marcar um ponto (já conferido e cortado no tamanho, ver pageMessages).
export type NewComment = Omit<PageComment, 'note' | 'route'>

// Posição atual de cada ponto (x, y, à vista); nula quando o elemento saiu da página.
export type CommentPositions = Record<number, [number, number, boolean] | null>
