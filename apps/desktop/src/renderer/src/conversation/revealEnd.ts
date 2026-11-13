// Abrir de novo uma conversa que já está à vista (o card dela, a notificação, a lista de conversas)
// leva a conversa para o fim, onde está a última resposta. Antes ela ficava onde você tinha subido
// para ler. Conversa que ainda não está à vista não precisa: abre no fim (useStickyScroll).
const listeners = new Set<(id: string) => void>()

export function revealEnd(id: string): void {
  // Cópia: quem sai ou entra durante o aviso não bagunça a volta.
  for (const listener of [...listeners]) listener(id)
}

// `id` é o da conversa ou o da sessão dela, como cada um que abre conhece.
export function onRevealEnd(listener: (id: string) => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
