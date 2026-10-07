import { useEffect, useState } from 'react'
import type { Message } from './types'

// "14:32" hoje; "06/10 14:32" em outro dia.
export function formatClock(iso: string | number): string {
  const d = new Date(iso)
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return d.toDateString() === new Date().toDateString()
    ? time
    : `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${time}`
}

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}min ${String(s % 60).padStart(2, '0')}s`
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}min`
}

export function formatTokens(n: number): string {
  if (n < 1000) return `${n} tokens`
  return `${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil tokens`
}

// Tempo correndo desde o início do pedido, atualizado a cada segundo.
export function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return <>{formatDuration(now - since)}</>
}

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
