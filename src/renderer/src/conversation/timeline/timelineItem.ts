import type { ReactNode } from 'react'

// Um item da linha do tempo da conversa: mensagem sua (balão), divisor ou passo do Claude (com a
// bolinha à esquerda e a linha até o próximo passo).
export type TimelineItem =
  | { kind: 'user'; key: string; node: ReactNode }
  | { kind: 'divider'; key: string; node: ReactNode }
  | { kind: 'step'; key: string; dot: string; dotTop?: number; node: ReactNode }

// Altura da bolinha (topo, em px) para ficar no meio da primeira linha do passo. A padrão
// serve à resposta (15px, leading-relaxed); ações e raciocínio têm linha de 20px com 4px
// de respiro em cima; o subagente ainda tem borda e padding da caixa.
export const DOT_ROW = 10.5
export const DOT_AGENT = 15.5

export const stepItem = (key: string, dot: string, node: ReactNode, dotTop?: number): TimelineItem => ({
  kind: 'step',
  key,
  dot,
  dotTop,
  node
})
