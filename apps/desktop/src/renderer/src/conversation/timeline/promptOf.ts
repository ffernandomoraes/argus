import type { Message } from '../types'
import type { PendingSend } from './optimisticSends'

// Texto do prompt preso no topo: a mensagem sua com essa chave, gravada ou ainda a caminho.
export function promptOf(key: string | null, messages: Message[], waiting: PendingSend[]): { text: string; images: number } | null {
  if (!key) return null
  const m = messages.find((m) => m.role === 'user' && m.id === key)
  if (m?.role === 'user') return { text: m.text, images: m.images ?? 0 }
  const w = waiting.find((w) => w.id === key)
  return w ? { text: w.text, images: w.images } : null
}
