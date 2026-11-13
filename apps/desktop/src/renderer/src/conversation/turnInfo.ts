import type { Message } from './types'

// O contador de tempo mora em Elapsed.tsx; continua saindo daqui para quem já importava assim
// (a linha do subagente na pasta).
export { Elapsed } from './Elapsed'

export type TurnFooter = { at: string; duration?: number; tokens: number }

// Cada pedido (sua mensagem até a próxima) ganha um rodapé na última resposta do Claude:
// quando terminou, quanto levou e quantos tokens gerou. O pedido em andamento não ganha.
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
    // O raciocínio não fecha o pedido: o rodapé vai na última resposta em texto.
    if (m.role === 'assistant') lastReply = m
  }
  if (!running) close()
  return out
}

// Pedido em andamento pelo histórico: quando foi a última mensagem sua e os tokens desde ela.
export function currentTurn(messages: Message[]): { startedAt?: number; tokens: number } {
  let tokens = 0
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role === 'user' && !m.queued) return { startedAt: m.at ? Date.parse(m.at) : undefined, tokens }
    tokens += m.role === 'assistant' || m.role === 'thinking' || m.role === 'tool' ? (m.tokens ?? 0) : 0
  }
  return { tokens }
}
