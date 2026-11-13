import type { Message } from '@argus/shared/history'

// Cópia de apps/desktop/src/renderer/src/conversation/turnInfo.ts (o de lá importa tipos da janela): cada
// pedido (sua mensagem até a próxima) ganha um rodapé na última resposta em texto, com quando
// terminou, quanto levou e quantos tokens gerou. O pedido em andamento não ganha.
export type TurnFooter = { at: string; duration?: number; tokens: number }

export function turnFooters(messages: Message[], running: boolean): Map<string, TurnFooter> {
  const out = new Map<string, TurnFooter>()
  let start: string | undefined
  let tokens = 0
  let lastReply: Message | undefined
  const close = () => {
    if (lastReply?.at) {
      const duration = start ? Date.parse(lastReply.at) - Date.parse(start) : undefined
      out.set(lastReply.id, { at: lastReply.at, duration, tokens })
    }
  }
  for (const m of messages) {
    // Mensagem enviada no meio da resposta faz parte do mesmo pedido.
    if (m.role === 'user' && !m.queued) {
      close()
      start = m.at
      tokens = 0
      lastReply = undefined
      continue
    }
    tokens += m.role === 'assistant' || m.role === 'thinking' || m.role === 'tool' ? (m.tokens ?? 0) : 0
    if (m.role === 'assistant') lastReply = m
  }
  if (!running) close()
  return out
}
